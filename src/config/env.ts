import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_OWNER: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  ROOT_DOMAIN: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().default('iwd'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

let cached: z.infer<typeof schema> | undefined;
export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}
