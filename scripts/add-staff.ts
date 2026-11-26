/** Gives an existing user access to the super-admin console: npm run staff:add -- <email> [admin|support] */
import postgres from 'postgres';

const [email, role = 'support'] = process.argv.slice(2);
if (!email || !['admin', 'support'].includes(role)) throw new Error('Usage: staff:add <email> [admin|support]');
const sql = postgres(process.env.DATABASE_URL_OWNER!, { max: 1 });
const [u] = await sql<{ id: string }[]>`select id from users where email = ${email.toLowerCase()}`;
if (!u) throw new Error(`No user with email ${email}`);
await sql`insert into platform_staff (user_id, role) values (${u.id}, ${role}) on conflict (user_id) do update set role = excluded.role`;
console.log(`${email} is now platform ${role}`);
await sql.end();
