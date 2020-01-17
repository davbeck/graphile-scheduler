import { PoolClient } from "pg";
import { readdir, readFile } from "graphile-worker/dist/fs";
import { migrate as migrateWorker } from "graphile-worker/dist/migrate";

async function installSchema(client: PoolClient) {
  await client.query(`
    create extension if not exists pgcrypto with schema public;
    create schema if not exists graphile_scheduler;
    create table graphile_scheduler.migrations(
      id int primary key,
      ts timestamptz default now() not null
    );
  `);
}

async function runMigration(
  client: PoolClient,
  migrationFile: string,
  migrationNumber: number
) {
  const text = await readFile(`${__dirname}/../sql/${migrationFile}`, "utf8");
  await client.query("begin");
  try {
    await client.query({
      text,
    });
    await client.query({
      text: `insert into graphile_scheduler.migrations (id) values ($1)`,
      values: [migrationNumber],
    });
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}

export async function migrate(client: PoolClient) {
  // our schema relies on the worker schema
  await migrateWorker(client);

  let latestMigration: number | null = null;
  try {
    const {
      rows: [row],
    } = await client.query(
      "select id from graphile_scheduler.migrations order by id desc limit 1;"
    );
    if (row) {
      latestMigration = row.id;
    }
  } catch (e) {
    if (e.code === "42P01") {
      await installSchema(client);
    } else {
      throw e;
    }
  }
  const migrationFiles = (await readdir(`${__dirname}/../sql`))
    .filter(f => f.match(/^[0-9]{6}\.sql$/))
    .sort();
  for (const migrationFile of migrationFiles) {
    const migrationNumber = parseInt(migrationFile.substr(0, 6), 10);
    if (latestMigration == null || migrationNumber > latestMigration) {
      await runMigration(client, migrationFile, migrationNumber);
    }
  }
}
