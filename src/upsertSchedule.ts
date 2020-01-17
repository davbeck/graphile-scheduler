import parseCron, { CronPattern } from "./parseCron";

export interface Schedule {
  name: string;
  pattern: string | CronPattern;
  timeZone: string;

  taskIdentifier?: string;
  queueName?: string;
  payload?: any;
  maxAttempts?: number;
}

export interface Options {
  inlineValues?: boolean;
}

export default function upsertSchedule(
  {
    name,
    pattern,
    timeZone,
    taskIdentifier,
    queueName,
    payload,
    maxAttempts,
  }: Schedule,
  { inlineValues = false }: Options = {}
): [string, any[]] {
  let cron: CronPattern;
  if (typeof pattern === "string") {
    cron = parseCron(pattern);
  } else {
    cron = pattern;
  }

  const task = taskIdentifier ?? name;

  let args: any[] = [];
  let values: string[] = [];
  for (const value of [
    cron.minute,
    cron.hour,
    cron.day,
    cron.month,
    cron.dow,
  ]) {
    if (inlineValues) {
      values.push(`'{${value.join(",")}}'`);
    } else {
      args.push(value);
      values.push(`$${args.length}`);
    }
  }
  for (const value of [name, timeZone, task, queueName, payload, maxAttempts]) {
    if (value == null) {
      values.push("DEFAULT");
    } else if (inlineValues) {
      if (typeof value === "number") {
        values.push(`${value}`);
      } else if (typeof value === "object") {
        values.push(`'${JSON.stringify(value)}'`);
      } else {
        values.push(`'${value}'`);
      }
    } else {
      args.push(value);
      values.push(`$${args.length}`);
    }
  }

  let sql = `INSERT INTO "graphile_scheduler"."schedules"
(minute, hour, day, month, dow, schedule_name, timezone, task_identifier, queue_name, payload, max_attempts)
VALUES (${values.join(", ")})
ON CONFLICT (schedule_name) DO UPDATE SET
  minute = EXCLUDED.minute,
  hour = EXCLUDED.hour,
  day = EXCLUDED.day,
  month = EXCLUDED.month,
  dow = EXCLUDED.dow,
  timezone = EXCLUDED.timezone,
  task_identifier = EXCLUDED.task_identifier,
  queue_name = EXCLUDED.queue_name,
  payload = EXCLUDED.payload,
  max_attempts = EXCLUDED.max_attempts;`;

  return [sql, args];
}
