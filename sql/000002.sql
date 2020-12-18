DROP IF EXISTS FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.schedules_matches(ebg_toolkit_cron.schedules,timestamp with time zone);

-- Re-create function to use the schedule.timezone to check date portions in the schedule
CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.schedules_matches(schedule :GRAPHILE_SCHEDULER_SCHEMA.schedules, check_time_raw TIMESTAMP WITH TIME ZONE = NOW())
RETURNS BOOLEAN
AS $$
DECLARE
  v_check_time TIMESTAMP WITH TIME ZONE;
BEGIN
  v_check_time := check_time_raw AT TIME ZONE schedule.timezone;
  RETURN EXTRACT(minute FROM v_check_time) = ANY(schedule.minute)
     AND EXTRACT(hour FROM v_check_time) = ANY(schedule.hour)
     AND EXTRACT(day FROM v_check_time) = ANY(schedule.day)
     AND EXTRACT(month FROM v_check_time) = ANY(schedule.month)
     AND EXTRACT(dow FROM v_check_time) = ANY(schedule.dow);
END;
$$ LANGUAGE plpgsql;
