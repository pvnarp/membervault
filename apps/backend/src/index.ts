import { serve } from '@hono/node-server';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './config/env.js';
import { createDb } from './db/index.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { getRedis } from './lib/redis.js';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

// Run migrations before starting the server (idempotent — skips already-applied)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, '../drizzle');
logger.info('Running database migrations...');
await migrate(db, { migrationsFolder });
logger.info('Migrations complete.');

// Connect to Redis if configured (used for rate limiting)
const redis = await getRedis(env.REDIS_URL);

const app = createApp(db, env, redis);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(`Application listening on port ${info.port}`);
});
