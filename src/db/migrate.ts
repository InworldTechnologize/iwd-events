/**
 * Migration runner. Applies migrations/*.sql in file-name order, once each, recorded in
 * _migrations with a checksum (an edited, already-applied file stops the run: migrations are
 * additive). File names: NNNN_name.sql for the base, YYYYMMDDHH_module.sql for module work, so
 * parallel branches never collide.
 *
 * Then makes sure the app role exists and has exactly the grants it needs. The app role is never
 * a table owner and never BYPASSRLS, so RLS applies to it.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';

export async function runMigrations(ownerUrl: string, appUrl: string, dir = join(process.cwd(), 'migrations')) {
  const app = new URL(appUrl);
  const appRole = decodeURIComponent(app.username);
  const appPassword = decodeURIComponent(app.password);
  if (!/^[a-z_][a-z0-9_]*$/.test(appRole)) throw new Error('Unsafe app role name');

  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    const exists = await sql`select 1 from pg_roles where rolname = ${appRole}`;
    if (exists.length === 0) {
      await sql.unsafe(`create role ${appRole} login nosuperuser nobypassrls nocreatedb nocreaterole password '${appPassword.replace(/'/g, "''")}'`);
    }
    await sql.unsafe(`alter role ${appRole} nosuperuser nobypassrls`);

    await sql`create table if not exists _migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())`;
    const applied = new Map((await sql<{ name: string; checksum: string }[]>`select name, checksum from _migrations`).map((r) => [r.name, r.checksum]));
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      const body = await readFile(join(dir, f), 'utf8');
      const sum = createHash('sha256').update(body).digest('hex');
      const prev = applied.get(f);
      if (prev) {
        if (prev !== sum) throw new Error(`Migration ${f} was changed after it was applied. Add a new migration instead.`);
        continue;
      }
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into _migrations (name, checksum) values (${f}, ${sum})`;
      });
    }

    await sql.unsafe(`
      grant usage on schema public to ${appRole};
      grant select, insert, update, delete on all tables in schema public to ${appRole};
      revoke all on _migrations from ${appRole};
      revoke insert, update, delete on plans from ${appRole};
      revoke update, delete on audit_log from ${appRole};
      revoke insert, update, delete on platform_staff from ${appRole};
      grant usage, select on all sequences in schema public to ${appRole};
      grant execute on function app_tenant_id(), resolve_host(text), user_memberships(text), create_tenant(text, text, text, text), platform_tenant_overview() to ${appRole};
    `);
  } finally {
    await sql.end();
  }
}
