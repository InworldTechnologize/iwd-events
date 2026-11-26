const base = process.env.TEST_DATABASE_BASE ?? 'postgres://postgres:postgres@localhost:5432';
export const TEST_OWNER_URL = `${base}/iwd_test`;
export const TEST_APP_URL = (process.env.TEST_APP_BASE ?? 'postgres://iwd_app:iwd_app@localhost:5432') + '/iwd_test';
