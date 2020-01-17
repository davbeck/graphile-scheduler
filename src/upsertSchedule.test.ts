import upsertSchedule from "./upsertSchedule";

describe(upsertSchedule, () => {
  it("generates sql", () => {
    const [sql, args] = upsertSchedule(
      {
        name: "something_new",
        pattern: "0 10 1 6 5",
        timeZone: "America/New_York",

        taskIdentifier: "something_new_task",
        queueName: "something_new_queue",
        payload: { hello: "world" },
        maxAttempts: 20,
      },
      { inlineValues: true }
    );

    expect(sql.replace(/\s/g, "")).toEqual(
      `
    INSERT INTO "graphile_scheduler"."schedules"
    (minute, hour, day, month, dow, schedule_name, timezone, task_identifier, queue_name, payload, max_attempts)
    VALUES (
      '{0}',
      '{10}',
      '{1}',
      '{6}',
      '{5}',
      'something_new',
      'America/New_York',
      'something_new_task',
      'something_new_queue',
      '{ "hello": "world" }',
      20
    )
    ON CONFLICT (schedule_name) DO UPDATE
    SET minute = EXCLUDED.minute,
        hour = EXCLUDED.hour,
        day = EXCLUDED.day,
        month = EXCLUDED.month,
        dow = EXCLUDED.dow,
        timezone = EXCLUDED.timezone,
        task_identifier = EXCLUDED.task_identifier,
        queue_name = EXCLUDED.queue_name,
        payload = EXCLUDED.payload,
        max_attempts = EXCLUDED.max_attempts;
    `.replace(/\s/g, "")
    );

    expect(args).toHaveLength(0);
  });

  it("generates sql with placeholders", () => {
    const [sql, args] = upsertSchedule({
      name: "something_new",
      pattern: "0 10 1 6 5",
      timeZone: "America/New_York",

      taskIdentifier: "something_new_task",
      queueName: "something_new_queue",
      payload: { hello: "world" },
      maxAttempts: 20,
    });

    expect(sql.replace(/\s/g, "")).toEqual(
      `
    INSERT INTO "graphile_scheduler"."schedules"
    (minute, hour, day, month, dow, schedule_name, timezone, task_identifier, queue_name, payload, max_attempts)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (schedule_name) DO UPDATE
    SET minute = EXCLUDED.minute,
        hour = EXCLUDED.hour,
        day = EXCLUDED.day,
        month = EXCLUDED.month,
        dow = EXCLUDED.dow,
        timezone = EXCLUDED.timezone,
        task_identifier = EXCLUDED.task_identifier,
        queue_name = EXCLUDED.queue_name,
        payload = EXCLUDED.payload,
        max_attempts = EXCLUDED.max_attempts;
    `.replace(/\s/g, "")
    );

    expect(args).toHaveLength(11);
  });

  it("generates sql defaulting taskIdentifier", () => {
    const args = upsertSchedule({
      name: "something_new",
      pattern: "0 10 1 6 5",
      timeZone: "America/New_York",

      queueName: "something_new_queue",
      payload: { hello: "world" },
      maxAttempts: 20,
    })[1];

    expect(args).toHaveLength(11);
    expect(args[7]).toEqual("something_new");
  });

  it("generates sql inlining defaults", () => {
    const [sql, args] = upsertSchedule(
      {
        name: "something_new",
        pattern: "0 10 1 6 5",
        timeZone: "America/New_York",
      },
      { inlineValues: true }
    );

    expect(sql.replace(/\s/g, "")).toEqual(
      `
    INSERT INTO "graphile_scheduler"."schedules"
    (minute, hour, day, month, dow, schedule_name, timezone, task_identifier, queue_name, payload, max_attempts)
    VALUES (
      '{0}',
      '{10}',
      '{1}',
      '{6}',
      '{5}',
      'something_new',
      'America/New_York',
      'something_new',
      DEFAULT,
      DEFAULT,
      DEFAULT
    )
    ON CONFLICT (schedule_name) DO UPDATE
    SET minute = EXCLUDED.minute,
        hour = EXCLUDED.hour,
        day = EXCLUDED.day,
        month = EXCLUDED.month,
        dow = EXCLUDED.dow,
        timezone = EXCLUDED.timezone,
        task_identifier = EXCLUDED.task_identifier,
        queue_name = EXCLUDED.queue_name,
        payload = EXCLUDED.payload,
        max_attempts = EXCLUDED.max_attempts;
    `.replace(/\s/g, "")
    );

    expect(args).toHaveLength(0);
  });
});
