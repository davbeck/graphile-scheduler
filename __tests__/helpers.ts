import * as pg from "pg";
import { migrate } from "../src/migrate";
import { runMigrations as runWorkerMigrations } from "graphile-worker";

export const TEST_CONNECTION_STRING =
  process.env.TEST_CONNECTION_STRING || "graphile_scheduler_test";

export async function withPgPool<T = any>(
  cb: (pool: pg.Pool) => Promise<T>
): Promise<T> {
  const pool = new pg.Pool({
    connectionString: TEST_CONNECTION_STRING,
  });
  try {
    return await cb(pool);
  } finally {
    pool.end();
  }
}

export async function withPgClient<T = any>(
  cb: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  return withPgPool(async pool => {
    const client = await pool.connect();
    try {
      return await cb(client);
    } finally {
      client.release();
    }
  });
}

export async function withTransaction<T = any>(
  cb: (client: pg.PoolClient) => Promise<T>,
  closeCommand = "rollback"
): Promise<T> {
  return withPgClient(async client => {
    await client.query("begin");
    try {
      return await cb(client);
    } finally {
      await client.query(closeCommand);
    }
  });
}

export async function reset(pgPool: pg.Pool) {
  await pgPool.query("drop schema if exists graphile_worker cascade;");
  await pgPool.query("drop schema if exists graphile_scheduler cascade;");

  await runWorkerMigrations({ pgPool });

  const client = await pgPool.connect();
  try {
    await migrate(client);
  } finally {
    await client.release();
  }
}
