/** Drops and recreates the dev database, migrates and seeds. Refuses to run in production. */
import postgres from 'postgres';
import { runMigrations } from '../src/db/migrate';

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset in production');
const ownerUrl = new URL(process.env.DATABASE_URL_OWNER!);
const name = ownerUrl.pathname.slice(1);
if (!/^iwd(_[a-z0-9]+)?$/.test(name)) throw new Error(`Refusing to reset database "${name}"`);
const admin = new URL(ownerUrl);
admin.pathname = '/postgres';
const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
await sql.unsafe(`drop database if exists ${name} with (force)`);
await sql.unsafe(`create database ${name}`);
await sql.end();
await runMigrations(ownerUrl.toString(), process.env.DATABASE_URL!);
console.log(`reset ${name}`);
