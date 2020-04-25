import { runOnce } from "../src/runner";
import { reset, withPgPool } from "./helpers";
import * as sinon from "sinon";
import * as moment from "moment";
import { processOptions } from "../src/lib";

describe("runner", () => {
  let clock = sinon.useFakeTimers();

  beforeEach(() => {
    clock = sinon.useFakeTimers(moment("2020-01-15 14:00:30").toDate());
  });

  afterEach(() => {
    clock.restore();
  });

  it("queues upcoming jobs", () =>
    withPgPool(async pgPool => {
      const { escapedWorkerSchema, escapedSchedulerSchema } = processOptions();

      await reset({}, pgPool);
      await pgPool.query(`
        INSERT INTO ${escapedSchedulerSchema}."schedules"
        ("schedule_name", "last_checked", "minute", "hour", "task_identifier") 
        VALUES('test', '2020-01-15 14:00:00', '{1}', '{14}', 'test');
      `);

      await runOnce({ pgPool });

      const { rows: jobs } = await pgPool.query(
        `SELECT * FROM ${escapedWorkerSchema}.jobs;`
      );
      expect(jobs).toHaveLength(1);
      expect(jobs[0].task_identifier).toEqual("test");
      moment(jobs[0].payload.fireDate).isSame(moment("2020-01-15 14:00:00"));
      expect(
        moment(jobs[0].payload.fireDate).isSame(moment("2020-01-15 14:01:00"))
      ).toBeTruthy();
      expect(
        moment(jobs[0].run_at).isSame(moment("2020-01-15 14:01:00"))
      ).toBeTruthy();
    }));
});
