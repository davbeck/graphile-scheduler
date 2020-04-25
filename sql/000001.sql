CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.every_minute() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(0,59) AS range;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.every_hour() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(0,23) AS range;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.every_day() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(1,31) AS range;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.every_month() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(1,12) AS range;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.every_dow() RETURNS integer[] AS $$
	SELECT ARRAY_AGG(range) FROM GENERATE_SERIES(0,7) AS range;
$$ LANGUAGE SQL;


-- Keep updated_at up to date
create function :GRAPHILE_SCHEDULER_SCHEMA.tg__update_timestamp() returns trigger as $$
begin
  new.updated_at = greatest(now(), old.updated_at + interval '1 millisecond');
  return new;
end;
$$ language plpgsql;


CREATE TABLE IF NOT EXISTS :GRAPHILE_SCHEDULER_SCHEMA."schedules" (
    "schedule_name" text,
    "last_checked" timestamp with time zone NOT NULL DEFAULT now(),
    
    "minute" integer[] NOT NULL DEFAULT :GRAPHILE_SCHEDULER_SCHEMA.every_minute(),
    "hour" integer[] NOT NULL DEFAULT :GRAPHILE_SCHEDULER_SCHEMA.every_hour(),
    "day" integer[] NOT NULL DEFAULT :GRAPHILE_SCHEDULER_SCHEMA.every_day(),
    "month" integer[] NOT NULL DEFAULT :GRAPHILE_SCHEDULER_SCHEMA.every_month(),
    "dow" integer[] NOT NULL DEFAULT :GRAPHILE_SCHEDULER_SCHEMA.every_dow(),
    "timezone" TEXT NOT NULL CHECK (NOW() AT TIME ZONE timezone IS NOT NULL) DEFAULT current_setting('TIMEZONE'),
    
    "task_identifier" text NOT NULL,
    "queue_name" text DEFAULT (public.gen_random_uuid())::text NOT NULL,
    "max_attempts" integer NOT NULL DEFAULT '25',
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY ("schedule_name")
);
ALTER TABLE :GRAPHILE_SCHEDULER_SCHEMA."schedules" ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER _100_timestamps BEFORE UPDATE ON :GRAPHILE_SCHEDULER_SCHEMA."schedules" FOR EACH ROW EXECUTE PROCEDURE :GRAPHILE_SCHEDULER_SCHEMA.tg__update_timestamp();


CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.schedules_matches(schedule :GRAPHILE_SCHEDULER_SCHEMA.schedules, check_time TIMESTAMP WITH TIME ZONE = NOW())
RETURNS BOOLEAN
AS $$
  SELECT EXTRACT(minute FROM check_time) = ANY(schedule.minute)
     AND EXTRACT(hour FROM check_time) = ANY(schedule.hour)
     AND EXTRACT(day FROM check_time) = ANY(schedule.day)
     AND EXTRACT(month FROM check_time) = ANY(schedule.month)
     AND EXTRACT(dow FROM check_time) = ANY(schedule.dow);
$$ LANGUAGE sql;


CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.check_schedule(schedule_names text[] = NULL, starting_At TIMESTAMP WITH TIME ZONE = NULL, until TIMESTAMP WITH TIME ZONE = NOW()) 
RETURNS :GRAPHILE_SCHEDULER_SCHEMA.schedules
AS $$
DECLARE
  v_schedule :GRAPHILE_SCHEDULER_SCHEMA.schedules;
  v_next_check TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT * INTO v_schedule
    FROM :GRAPHILE_SCHEDULER_SCHEMA.schedules
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
    
  	IF :GRAPHILE_SCHEDULER_SCHEMA.schedules_matches(v_schedule, v_next_check) THEN
      PERFORM :GRAPHILE_WORKER_SCHEMA.add_job(
        identifier := v_schedule.task_identifier,
        payload := json_build_object('fireDate', date_trunc('minute', v_next_check)),
        queue_name := v_schedule.queue_name, 
        run_at := date_trunc('minute', v_next_check), 
        max_attempts := v_schedule.max_attempts
      );
  	END IF;
  	
    EXIT WHEN v_next_check > until;
  END LOOP ;

  UPDATE :GRAPHILE_SCHEDULER_SCHEMA.schedules
    SET last_checked = v_next_check
    WHERE schedule_name = v_schedule.schedule_name
    RETURNING * INTO v_schedule;
    
  RETURN v_schedule;
END;
$$ LANGUAGE plpgsql;