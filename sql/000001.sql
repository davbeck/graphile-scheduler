CREATE OR REPLACE FUNCTION graphile_scheduler.every_minute() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(0,59) AS range;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION graphile_scheduler.every_hour() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(0,23) AS range;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION graphile_scheduler.every_day() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(1,31) AS range;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION graphile_scheduler.every_month() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(1,12) AS range;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION graphile_scheduler.every_dow() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(0,7) AS range;
$$ LANGUAGE SQL;


CREATE TABLE IF NOT EXISTS "graphile_scheduler"."schedules" (
    "schedule_name" text,
    "last_checked" timestamp with time zone NOT NULL DEFAULT now(),
    
    "minute" integer[] NOT NULL DEFAULT graphile_scheduler.every_minute(),
    "hour" integer[] NOT NULL DEFAULT graphile_scheduler.every_hour(),
    "day" integer[] NOT NULL DEFAULT graphile_scheduler.every_day(),
    "month" integer[] NOT NULL DEFAULT graphile_scheduler.every_month(),
    "dow" integer[] NOT NULL DEFAULT graphile_scheduler.every_dow(),
    "timezone" TEXT NOT NULL CHECK (NOW() AT TIME ZONE timezone IS NOT NULL) DEFAULT current_setting('TIMEZONE'),
    
    "task_identifier" text NOT NULL,
    "queue_name" text DEFAULT (public.gen_random_uuid())::text NOT NULL,
    "max_attempts" integer NOT NULL DEFAULT '25',
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY ("schedule_name")
);
ALTER TABLE "graphile_scheduler"."schedules" ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER _100_timestamps BEFORE UPDATE ON "graphile_scheduler"."schedules" FOR EACH ROW EXECUTE PROCEDURE graphile_worker.tg__update_timestamp();


CREATE OR REPLACE FUNCTION graphile_scheduler.schedules_matches(schedule graphile_scheduler.schedules, check_time TIMESTAMP WITH TIME ZONE = NOW())
RETURNS BOOLEAN
AS $$
  SELECT EXTRACT(minute FROM check_time) = ANY(schedule.minute)
     AND EXTRACT(hour FROM check_time) = ANY(schedule.hour)
     AND EXTRACT(day FROM check_time) = ANY(schedule.day)
     AND EXTRACT(month FROM check_time) = ANY(schedule.month)
     AND EXTRACT(dow FROM check_time) = ANY(schedule.dow);
$$ LANGUAGE sql;


CREATE OR REPLACE FUNCTION graphile_scheduler.check_schedule(schedule_names text[] = NULL, starting_At TIMESTAMP WITH TIME ZONE = NULL, until TIMESTAMP WITH TIME ZONE = NOW()) 
RETURNS graphile_scheduler.schedules
AS $$
DECLARE
  v_schedule graphile_scheduler.schedules;
  v_next_check TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT * INTO v_schedule
    FROM graphile_scheduler.schedules
    WHERE last_checked < until
    AND (schedule_names IS NULL OR schedule_name = any(schedule_names))
    ORDER BY last_checked ASC
    LIMIT 1
    FOR UPDATE OF schedules
    SKIP LOCKED;
  
  IF v_schedule IS NULL THEN
    RETURN NULL;
  END IF;

  v_next_check := greatest(starting_At, v_schedule.last_checked);

  LOOP
    v_next_check := v_next_check + interval '1 minute';
    
  	IF graphile_scheduler.schedules_matches(v_schedule, v_next_check) THEN
      PERFORM graphile_worker.add_job(
        identifier := v_schedule.task_identifier,
        payload := json_build_object('fireDate', date_trunc('minute', v_next_check)),
        queue_name := v_schedule.queue_name, 
        run_at := date_trunc('minute', v_next_check), 
        max_attempts := v_schedule.max_attempts
      );
  	END IF;
  	
    EXIT WHEN v_next_check > until;
  END LOOP ;

  UPDATE graphile_scheduler.schedules
    SET last_checked = v_next_check
    WHERE schedule_name = v_schedule.schedule_name
    RETURNING * INTO v_schedule;
    
  RETURN v_schedule;
END;
$$ LANGUAGE plpgsql;