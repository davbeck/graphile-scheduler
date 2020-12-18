DROP FUNCTION IF EXISTS :GRAPHILE_SCHEDULER_SCHEMA.schedules_matches(schedule :GRAPHILE_SCHEDULER_SCHEMA.schedules, check_time TIMESTAMP WITH TIME ZONE);

-- Re-create function to use the schedule.timezone to check date portions in the schedule
CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.schedules_matches(schedule :GRAPHILE_SCHEDULER_SCHEMA.schedules, check_time TIMESTAMP WITH TIME ZONE = NOW())
RETURNS BOOLEAN
AS $$
DECLARE
  v_check_time_converted_tz TIMESTAMP WITH TIME ZONE;
BEGIN
  v_check_time_converted_tz := check_time AT TIME ZONE schedule.timezone;
  RETURN EXTRACT(minute FROM v_check_time_converted_tz) = ANY(schedule.minute)
     AND EXTRACT(hour FROM v_check_time_converted_tz) = ANY(schedule.hour)
     AND EXTRACT(day FROM v_check_time_converted_tz) = ANY(schedule.day)
     AND EXTRACT(month FROM v_check_time_converted_tz) = ANY(schedule.month)
     AND EXTRACT(dow FROM v_check_time_converted_tz) = ANY(schedule.dow);
END;
$$ LANGUAGE plpgsql;
