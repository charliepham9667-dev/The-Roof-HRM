-- Fix get_reservations_for_reminder to use Vietnam timezone (UTC+7)
-- and include 'pending' status alongside 'confirmed'
CREATE OR REPLACE FUNCTION get_reservations_for_reminder(hours_ahead INTEGER DEFAULT 1)
RETURNS SETOF reservations AS $$
DECLARE
  now_local TIMESTAMPTZ;
  window_end TIMESTAMPTZ;
BEGIN
  now_local  := NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh';
  window_end := now_local + (hours_ahead || ' hours')::INTERVAL;

  RETURN QUERY
  SELECT * FROM reservations
  WHERE status IN ('confirmed', 'pending')
    AND reminder_sent = false
    AND (
      (reservation_date::text || 'T' || reservation_time::text)::timestamptz
        AT TIME ZONE 'Asia/Ho_Chi_Minh'
    ) BETWEEN now_local AND window_end;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
