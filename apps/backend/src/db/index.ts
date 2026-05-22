import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export function createDb(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    // Tuned for 3k-10k member orgs with concurrent admin + member + volunteer usage
    min: 2, // Keep 2 idle connections warm
    max: 20, // Max concurrent connections (Postgres default is 100)
    idleTimeoutMillis: 30_000, // Close idle connections after 30s
    connectionTimeoutMillis: 5_000, // Fail fast if pool exhausted
    maxUses: 7_500, // Recycle connections to prevent memory leaks
  });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
