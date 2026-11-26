import { runMigrations } from '../src/db/migrate';

const owner = process.env.DATABASE_URL_OWNER;
const app = process.env.DATABASE_URL;
if (!owner || !app) throw new Error('Set DATABASE_URL_OWNER and DATABASE_URL');
await runMigrations(owner, app);
console.log('migrations done');
