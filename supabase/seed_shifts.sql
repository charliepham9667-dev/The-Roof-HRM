-- Seed Shifts Data
-- Run this after you have at least one user in profiles

-- First, get your user ID (replace with actual query result)
-- SELECT id FROM profiles LIMIT 1;

-- Then insert shifts for this week
-- Replace 'YOUR_USER_ID' with the actual UUID from profiles

DO $$
DECLARE
  staff_id UUID;
BEGIN
  -- Get first user from profiles
  SELECT id INTO staff_id FROM profiles LIMIT 1;
  
  IF staff_id IS NOT NULL THEN
    -- Clear existing shifts
    DELETE FROM shifts;
    
    -- Insert shifts for current week
    INSERT INTO shifts (staff_id, shift_date, start_time, end_time, role, status, notes)
    VALUES
      -- Today
      (staff_id, CURRENT_DATE, '14:00', '22:00', 'bartender', 'scheduled', 'Opening shift'),
      
      -- Tomorrow
      (staff_id, CURRENT_DATE + 1, '18:00', '02:00', 'bartender', 'scheduled', 'Evening shift'),
      
      -- Day after
      (staff_id, CURRENT_DATE + 2, '14:00', '22:00', 'manager', 'scheduled', NULL),
      
      -- 3 days from now
      (staff_id, CURRENT_DATE + 3, '20:00', '04:00', 'bartender', 'scheduled', 'Weekend shift'),
      
      -- Yesterday (completed)
      (staff_id, CURRENT_DATE - 1, '14:00', '22:00', 'bartender', 'completed', 'Regular shift');
      
    RAISE NOTICE 'Inserted 5 shifts for staff_id: %', staff_id;
  ELSE
    RAISE NOTICE 'No profiles found. Please create a user first.';
  END IF;
END $$;

-- Verify
SELECT 
  s.shift_date,
  s.start_time,
  s.end_time,
  s.role,
  s.status,
  p.full_name
FROM shifts s
JOIN profiles p ON s.staff_id = p.id
ORDER BY s.shift_date;
