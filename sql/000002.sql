CREATE OR REPLACE FUNCTION :GRAPHILE_SCHEDULER_SCHEMA.schedules_matches(schedule :GRAPHILE_SCHEDULER_SCHEMA.schedules, check_time TIMESTAMP WITH TIME ZONE = NOW())
RETURNS BOOLEAN
AS $$
  SELECT EXTRACT(minute FROM check_time AT TIME ZONE schedule.timezone) = ANY(schedule.minute)
     AND EXTRACT(hour FROM check_time AT TIME ZONE schedule.timezone) = ANY(schedule.hour)
     AND EXTRACT(day FROM check_time AT TIME ZONE schedule.timezone) = ANY(schedule.day)
     AND EXTRACT(month FROM check_time AT TIME ZONE schedule.timezone) = ANY(schedule.month)
     AND EXTRACT(dow FROM check_time AT TIME ZONE schedule.timezone) = ANY(schedule.dow);
$$ LANGUAGE sql;
