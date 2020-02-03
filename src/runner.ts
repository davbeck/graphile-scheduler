import * as assert from "assert";
import * as moment from "moment";
import { Pool } from "pg";
import { migrate } from "./migrate";
import {
  Task,
  RunnerOptions as WorkerRunnerOptions,
  Runner as WorkerRunner,
  run as runWorker,
  runOnce as runWorkerOnce,
} from "graphile-worker";
import { defaultLogger, Logger } from "graphile-worker/dist/logger";
import upsertSchedule, { Schedule } from "./upsertSchedule";

export interface ScheduleConfig extends Schedule {
  task?: Task;
}

export interface RunnerOptions extends WorkerRunnerOptions {
  checkInterval?: number;
  leadTime?: number;
  maxAge?: number;
  schedules?: (string | ScheduleConfig)[];
}

export class Runner {
  workerOptions: WorkerRunnerOptions;
  pgPool: Pool;
  logger: Logger;
  schedules?: (string | ScheduleConfig)[];
  scheduleNames?: string[];
  checkInterval: number;
  leadTime: number;
  maxAge: number;

  interval: NodeJS.Timeout | null;
  workerRunner: WorkerRunner | null;

  constructor({
    schedules,
    pgPool,
    connectionString,
    checkInterval,
    leadTime,
    maxAge,
    ...options
  }: RunnerOptions) {
    this.checkInterval = checkInterval ?? 60 * 1000;
    this.leadTime = leadTime ?? 0;
    this.maxAge = maxAge ?? 1000 * 60 * 60 * 24 * 3;

    this.logger = options.logger ?? defaultLogger;

    assert(
      !pgPool || !connectionString,
      "Both `pgPool` and `connectionString` are set, at most one of these options should be provided"
    );

    if (pgPool) {
      this.pgPool = pgPool;
    } else if (connectionString) {
      this.pgPool = new Pool({ connectionString: connectionString });
    } else if (process.env.DATABASE_URL) {
      this.pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    } else {
      throw new Error(
        "You must either specify `pgPool` or `connectionString`, or you must make the `DATABASE_URL` environmental variable available."
      );
    }

    this.pgPool.on("error", err => {
      /*
       * This handler is required so that client connection errors don't bring
       * the server down (via `unhandledError`).
       *
       * `pg` will automatically terminate the client and remove it from the
       * pool, so we don't actually need to take any action here, just ensure
       * that the event listener is registered.
       */
      this.logger.error(`PostgreSQL client generated error: ${err.message}`, {
        error: err,
      });
    });

    this.schedules = schedules;
    this.scheduleNames = schedules?.map(s =>
      typeof s === "string" ? s : s.name
    );

    // add in our embed schedule tasks
    let taskList = options.taskList ?? {};
    for (const schedule of this.schedules ?? []) {
      if (typeof schedule === "object" && schedule.task != null) {
        if (options.taskDirectory != null) {
          throw new Error(
            "You cannot specify `taskDirectory` and `task` in `schedules`."
          );
        }

        taskList = { ...taskList, [schedule.name]: schedule.task };
      }
    }

    this.workerOptions = { ...options, taskList, pgPool: this.pgPool };
  }

  get shouldRunWorker(): boolean {
    return (
      this.workerOptions.taskDirectory !== undefined ||
      (this.workerOptions.taskList !== undefined &&
        Object.keys(this.workerOptions.taskList).length > 0)
    );
  }

  async runMigrations() {
    const client = await this.pgPool.connect();

    try {
      await migrate(client);

      for (const schedule of this.schedules ?? []) {
        if (typeof schedule === "object") {
          const [sql, args] = upsertSchedule(schedule);
          await client.query(sql, args);
        }
      }
    } finally {
      await client.release();
    }
  }

  private async check() {
    const client = await this.pgPool.connect();
    const checkDate = moment().add(this.checkInterval + this.leadTime, "ms");
    const startingAt = moment().subtract(this.maxAge, "ms");

    this.logger.debug(`running check from ${startingAt} to ${checkDate}`);
    try {
      let updated: string | null = null;
      do {
        const res = await client.query(
          "SELECT * FROM graphile_worker.check_schedule($1, $2, $3)",
          [this.scheduleNames, startingAt, checkDate.toDate()]
        );
        updated = res.rows[0].schedule_name;

        if (updated) {
          this.logger.debug(`${updated} checked`);
        }
      } while (updated != null);
    } finally {
      await client.release();
    }
  }

  async runOnce() {
    await this.runMigrations();

    await this.check();

    if (this.shouldRunWorker) {
      await runWorkerOnce(this.workerOptions);
    }
  }

  async run() {
    await this.runMigrations();

    this.check();
    this.interval = setInterval(async () => {
      this.check();
    }, this.checkInterval);

    if (this.shouldRunWorker) {
      this.workerRunner = await runWorker(this.workerOptions);
    }
  }

  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;

      await this.workerRunner?.stop();
      this.workerRunner = null;
    } else {
      throw new Error("Runner is already stopped");
    }
  }
}

export async function run(options: RunnerOptions) {
  let runner = new Runner(options);
  await runner.run();
  return runner;
}

export async function runOnce(options: RunnerOptions) {
  let runner = new Runner(options);
  await runner.runOnce();
  return runner;
}
