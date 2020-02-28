import * as pg from "pg";
import { migrate } from "../src/migrate";

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

function isPoolClient(o: any): o is pg.PoolClient {
  return o && typeof o.release === "function";
}

export async function reset(pgPoolOrClient: pg.Pool | pg.PoolClient) {
  await pgPoolOrClient.query("drop schema if exists graphile_worker cascade;");
  await pgPoolOrClient.query("drop schema if exists graphile_worker cascade;");
  if (isPoolClient(pgPoolOrClient)) {
    await migrate(pgPoolOrClient);
  } else {
    const client = await pgPoolOrClient.connect();
    try {
      await migrate(client);
    } finally {
      await client.release();
    }
  }
}
