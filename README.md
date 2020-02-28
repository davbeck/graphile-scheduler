# graphile-scheduler

Reliable job scheduling for PostgreSQL running on Node.js built on top of [graphile-worker](https://github.com/graphile/worker). Allows you to run jobs on a regular schedule (e.g. sending reminders once a week, cleaning up data nightly, etc) with fault tolerance and resilience. Can be used with any PostgreSQL-backed application. Pairs beautifully with PostGraphile.

Why not use something like node-cron or a timer? These in process approaches have 2 downsides: 1) you have to make sure that there is only 1 process running the schedule or you risk running the tasks multiple times and 2) if that 1 process happens to be down (either due to an outage or a deploy) when the scheduled job is suppose to be excecuted, it will be skipped.

graphile-scheduler keeps track of it's schedules in a PostgreSQL database. On startup it will queue any jobs that should have occurred since the last time it was checked, whether that was 1 minute ago or 1 day ago (up to a certain limit determined by your configuration). It uses PostgreSQL locking so it's safe to have multipel schedulers running at once. And because it is integrated with graphile-worker, jobs are queued and automatically retried with exponential backoff if they fail.

## Quickstart

### Add the scheduler to your project:

```sh
yarn add graphile-scheduler
# or: npm install --save graphile-scheduler
```

### Schedule and run jobs:

```js
run({
  connectionString: "postgres:///",
  schedules: [
    {
      name: "send_reminder",
      pattern: "0 10 * * 1-5", // every weekday at 10AM
      timeZone: "America/Los_Angeles",
      task: async ({ fireDate }) => {
        console.log("send a reminder for", fireDate);
      },
    },
  ],
});
```

Every weekday at 10AM the task function will be called. You can use `fireDate` to access the time the job was originally suppose to be run. If the scheduler goes down and retroactively queues schedules that it missed or the job is retried, this will be when it should have been queued.

### Schedule and run jobs separately:

If you provide a task function an instance of graphile-worker will also be started to run the task. However you can have the runner only schedule jobs and have a separate process actually run them off of the queue:

```js
run({
  connectionString: "postgres:///",
  schedules: [
    {
      name: "send_reminder",
      pattern: "0 10 * * 1-5", // every weekday at 10AM
      timeZone: "America/Los_Angeles",
    },
  ],
});
```

Or you can create schedules manually in the database and only run schedule checks:

```sql
INSERT INTO "graphile_scheduler"."schedules"
(
	"schedule_name",
	"minute",
	"hour",
	"day",
	"month",
	"dow",
	"timezone",
	"task_identifier"
)
VALUES(
	'foo',
	'{0}',
	'{10}',
	graphile_scheduler.every_day(),
	graphile_scheduler.every_month(),
	'{1,2,3,4,5}',
	'America/Los_Angeles',
	'foo'
);
```

```js
run({
  connectionString: "postgres:///",
  schedules: ["send_reminder"],
});
```

If you omit `schedules` completely, every schedule in the database will be checked.

```js
run({ connectionString: "postgres:///" });
```

## Status

This project is feature complete and in use, but has not yet been battle tested and test coverage is incomplete. It is possilbe that there will be breaking changes leading up to a 1.0.0 release.

Additionally, graphile-worker is still in early development as well, so until it reaches 1.0.0 the project pins it's dependency to it at a fixed version number.
