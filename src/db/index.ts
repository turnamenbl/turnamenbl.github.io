import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

// Don't throw at import time (this would break builds when DATABASE_URL isn't set).
// Only initialize the pool when a connection is actually attempted.
let pool: Pool | null = null;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function getPool(): Pool {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for the Postgres database that stores the app_settings table."
    );
  }
  if (process.env.NODE_ENV === "production") {
    if (!pool) pool = new Pool({ connectionString: databaseUrl });
    return pool;
  }
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = new Pool({
      connectionString: databaseUrl,
    });
  }
  return globalForDb.__arenaNextJsPostgresqlPool;
}

// Wrap the drizzle client with a lazy-initialized proxy so imports don't crash the build.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const poolInstance = getPool();
    const drizzleInstance = drizzle(poolInstance);
    return (drizzleInstance as any)[prop];
  },
});
