-- Seed recurring venue events for The Roof, Da Nang
-- Covers Feb–Jun 2026. Idempotent: skips rows with the same title + start_date.

DO $$
DECLARE
  d DATE;
  dow INT; -- 0=Sun,1=Mon,...,6=Sat
BEGIN

-- ── Tết Season block (Feb 17–21 2026) ────────────────────────────────────────
INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, color, is_active, is_all_day)
VALUES
  ('Mùng 1 Tết – Club Night', 'Tết opening night. DJ CharleS & DCrown. Full house expected.', 'club_night', '2026-02-17', '2026-02-17', '21:00', '03:00', '#c9a84c', true, false),
  ('Mùng 2 Tết – Girls Night',  'Ladies Night special. DJ CharleS & Cece. Prosecco 2-for-1.', 'club_night', '2026-02-18', '2026-02-18', '21:00', '03:00', '#c9a84c', true, false),
  ('Mùng 3 Tết – Club Night', 'DJ Dark & Kazho. Special Tết décor & menu.', 'club_night', '2026-02-19', '2026-02-19', '21:00', '03:00', '#c9a84c', true, false),
  ('Mùng 4 Tết – Club Night', 'DJ CharleS & ThroBak. Tết finale.', 'club_night', '2026-02-20', '2026-02-20', '21:00', '03:00', '#c9a84c', true, false),
  ('Mùng 5 Tết – Club Night', 'Tết wrap-up night. DJ lineup TBC.', 'club_night', '2026-02-21', '2026-02-21', '21:00', '03:00', '#c9a84c', true, false)
ON CONFLICT DO NOTHING;

-- ── International Women's Day – Mar 8 ────────────────────────────────────────
INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, color, is_active, is_all_day)
VALUES (
  'International Women''s Day', 'Ladies special: prosecco & cocktail deals all night. Full team.',
  'themed', '2026-03-08', '2026-03-08', '21:00', '03:00', '#9b59b6', true, false
) ON CONFLICT DO NOTHING;

-- ── Easter Weekend – Apr 4–5 ─────────────────────────────────────────────────
INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, color, is_active, is_all_day)
VALUES
  ('Easter Saturday – Club Night', 'DJ Marco monthly residency. Bottle service packages.', 'club_night', '2026-04-04', '2026-04-04', '21:00', '03:00', '#e67e22', true, false),
  ('Easter Sunday – Lounge Day', 'Relaxed Sunday lounge. Light bites & acoustic set.', 'lounge', '2026-04-05', '2026-04-05', '14:00', '22:00', '#2d7a4f', true, false)
ON CONFLICT DO NOTHING;

-- ── Labour Day – May 1 ────────────────────────────────────────────────────────
INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, color, is_active, is_all_day)
VALUES (
  'Labour Day – Club Night', 'Public holiday club night. DJ CharleS headlining.',
  'club_night', '2026-05-01', '2026-05-01', '21:00', '03:00', '#e74c3c', true, false
) ON CONFLICT DO NOTHING;

-- ── Reunification Day – Apr 30 ───────────────────────────────────────────────
INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, color, is_active, is_all_day)
VALUES (
  'Reunification Day – Club Night', 'Holiday club night. Full team on deck.',
  'club_night', '2026-04-30', '2026-04-30', '21:00', '03:00', '#e74c3c', true, false
) ON CONFLICT DO NOTHING;

-- ── Weekly recurring: Fri Club Night (SaturPlay moved to Fri/Sat) ────────────
-- Fridays: Club Night with DJ CharleS or DJ Marco alternating
-- Saturdays: SaturPlay Club Night
-- Wednesdays: Ladies Night (Lounge)
-- Thursdays: Lounge Night

d := '2026-02-22'; -- First Sunday after Tết
WHILE d <= '2026-06-30' LOOP
  dow := EXTRACT(DOW FROM d); -- 0=Sun,1=Mon,...,5=Fri,6=Sat

  -- Wednesday: Ladies Night
  IF dow = 3 THEN
    INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, color, is_active, is_all_day)
    VALUES (
      'Ladies Night',
      'Prosecco 2-for-1 all night. Weekly themed lounge evening.',
      'themed', d, d, '19:00', '02:00', '#9b59b6', true, false
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Thursday: Lounge Night
  IF dow = 4 THEN
    INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, color, is_active, is_all_day)
    VALUES (
      'Lounge Night',
      'Regular Thursday lounge. DJ Minh chill set 19:00–22:00. Free tea with shisha.',
      'lounge', d, d, '19:00', '02:00', '#2d7a4f', true, false
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Friday: Club Night
  IF dow = 5 THEN
    INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, color, is_active, is_all_day)
    VALUES (
      'Club Night – Friday',
      'DJ CharleS / DJ Marco alternating Friday residency. 21:00 set.',
      'club_night', d, d, '21:00', '03:00', '#b5620a', true, false
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Saturday: SaturPlay
  IF dow = 6 THEN
    INSERT INTO events (title, description, event_type, start_date, end_date, start_time, end_time, color, is_active, is_all_day)
    VALUES (
      'SaturPlay – Club Night',
      'Weekly Saturday club night. DJ Dark opening 21:30, headline DJ 23:00.',
      'club_night', d, d, '21:00', '03:00', '#b5620a', true, false
    ) ON CONFLICT DO NOTHING;
  END IF;

  d := d + INTERVAL '1 day';
END LOOP;

END $$;
