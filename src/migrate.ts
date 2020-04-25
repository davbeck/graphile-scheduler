import { PoolClient } from "pg";
import * as fs from "fs";
import { promisify } from "util";
import { RunnerOptions } from "./runner";
import { processOptions } from "./lib";

export const readFile = promisify(fs.readFile);
export const readdir = promisify(fs.readdir);

export async function migrate(options: RunnerOptions, client: PoolClient) {
  const { escapedWorkerSchema, escapedSchedulerSchema } = processOptions(
    options
  );

  let latestMigration: number | null = null;
  try {
    const {
      rows: [row],
    } = await client.query(
      `select id from ${escapedSchedulerSchema}.migrations order by id desc limit 1;`
    );
    if (row) {
      latestMigration = row.id;
    }
  } catch (e) {
    if (e.code === "42P01") {
      await client.query(`
        create extension if not exists pgcrypto with schema public;
        create schema if not exists ${escapedSchedulerSchema};
        create table ${escapedSchedulerSchema}.migrations(
          id int primary key,
          ts timestamptz default now() not null
        );
      `);
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
      const rawText = await readFile(
        `${__dirname}/../sql/${migrationFile}`,
        "utf8"
      );
      const text = rawText
        .replace(/:GRAPHILE_WORKER_SCHEMA\b/g, escapedWorkerSchema)
        .replace(/:GRAPHILE_SCHEDULER_SCHEMA\b/g, escapedSchedulerSchema);

      await client.query("begin");
      try {
        await client.query({
          text,
        });
        await client.query({
          text: `insert into ${escapedSchedulerSchema}.migrations (id) values ($1)`,
          values: [migrationNumber],
        });
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
  }
}
