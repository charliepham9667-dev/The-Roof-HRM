-- =============================================
-- Create Scheduling Tables (Shifts, Templates, Time Off)
-- =============================================
-- Note: This project models employees as `public.profiles` (not an `employees` table).
-- So foreign keys below reference `public.profiles(id)`.
--
-- This migration is written to be safe with existing schemas:
-- - If `shifts` already exists (it does in this repo), we *extend* it to support:
--   - `employee_id` (alias of existing staff_id)
--   - `date`        (alias of existing shift_date)
--   - `created_by`
--   - status allowing 'published' in addition to existing statuses
-- - If `shifts` does not exist, we create it as requested.

-- ---------- Enums ----------
DO $$
BEGIN
  CREATE TYPE shift_status AS ENUM ('scheduled', 'published', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE time_off_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------- SHIFTS ----------
DO $$
BEGIN
  IF to_regclass('public.shifts') IS NULL THEN
    -- Create shifts table (new install)
    CREATE TABLE public.shifts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      role TEXT NOT NULL,
      notes TEXT,
      status shift_status NOT NULL DEFAULT 'scheduled',
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- Existing shifts table: add requested columns in a backwards-compatible way
    -- Existing schema uses:
    --   staff_id (uuid -> profiles.id)
    --   shift_date (date)
    --   status (text check constraint; includes scheduled/in_progress/completed/no_show/cancelled)

    -- Add alias columns if missing
    ALTER TABLE public.shifts
      ADD COLUMN IF NOT EXISTS employee_id UUID,
      ADD COLUMN IF NOT EXISTS date DATE,
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

    -- Backfill alias columns from existing columns when present
    -- (safe even if staff_id/shift_date don't exist)
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'staff_id'
    ) THEN
      UPDATE public.shifts SET employee_id = staff_id WHERE employee_id IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shifts' AND column_name = 'shift_date'
    ) THEN
      UPDATE public.shifts SET date = shift_date WHERE date IS NULL;
    END IF;

    -- Add FK for employee_id once backfilled
    BEGIN
      ALTER TABLE public.shifts
        ADD CONSTRAINT shifts_employee_id_fkey
        FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    -- Make alias columns NOT NULL if data is present
    BEGIN
      ALTER TABLE public.shifts ALTER COLUMN employee_id SET NOT NULL;
    EXCEPTION
      WHEN others THEN NULL;
    END;

    BEGIN
      ALTER TABLE public.shifts ALTER COLUMN date SET NOT NULL;
    EXCEPTION
      WHEN others THEN NULL;
    END;

    -- Expand status constraint to include 'published' while keeping existing values.
    -- Drop any existing CHECK constraint that constrains status.
    DECLARE c RECORD;
    BEGIN
      FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.shifts'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS %I', c.conname);
      END LOOP;
    END;

    -- Re-add a permissive status CHECK (keeps older app statuses, adds published)
    ALTER TABLE public.shifts
      ADD CONSTRAINT shifts_status_check
      CHECK (status IN ('scheduled','published','in_progress','completed','no_show','cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shifts_employee_date ON public.shifts(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shifts(date);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Staff can view their own shifts; managers/owners can view all
DROP POLICY IF EXISTS "Shifts viewable by role" ON public.shifts;
CREATE POLICY "Shifts viewable by role"
  ON public.shifts FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR is_manager_or_owner());

-- Managers/owners can create shifts
DROP POLICY IF EXISTS "Shifts insertable by managers" ON public.shifts;
CREATE POLICY "Shifts insertable by managers"
  ON public.shifts FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_or_owner());

-- Managers/owners can update shifts
DROP POLICY IF EXISTS "Shifts updatable by managers" ON public.shifts;
CREATE POLICY "Shifts updatable by managers"
  ON public.shifts FOR UPDATE
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Managers/owners can delete shifts
DROP POLICY IF EXISTS "Shifts deletable by managers" ON public.shifts;
CREATE POLICY "Shifts deletable by managers"
  ON public.shifts FOR DELETE
  TO authenticated
  USING (is_manager_or_owner());

-- ---------- SHIFT TEMPLATES ----------
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_templates_day ON public.shift_templates(day_of_week);
CREATE INDEX IF NOT EXISTS idx_shift_templates_active ON public.shift_templates(is_active) WHERE is_active = true;

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read templates (needed for scheduling UI); only managers/owners can write.
DROP POLICY IF EXISTS "Shift templates viewable by authenticated" ON public.shift_templates;
CREATE POLICY "Shift templates viewable by authenticated"
  ON public.shift_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Shift templates manageable by managers" ON public.shift_templates;
CREATE POLICY "Shift templates manageable by managers"
  ON public.shift_templates FOR ALL
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- ---------- TIME OFF REQUESTS ----------
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status time_off_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_time_off_employee ON public.time_off_requests(employee_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_time_off_status ON public.time_off_requests(status);

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- Staff can view their own requests; managers/owners can view all
DROP POLICY IF EXISTS "Time off viewable by role" ON public.time_off_requests;
CREATE POLICY "Time off viewable by role"
  ON public.time_off_requests FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR is_manager_or_owner());

-- Staff can create their own requests
DROP POLICY IF EXISTS "Time off requestable by self" ON public.time_off_requests;
CREATE POLICY "Time off requestable by self"
  ON public.time_off_requests FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Managers/owners can approve/reject (update) and delete
DROP POLICY IF EXISTS "Time off manageable by managers" ON public.time_off_requests;
CREATE POLICY "Time off manageable by managers"
  ON public.time_off_requests FOR UPDATE
  TO authenticated
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

DROP POLICY IF EXISTS "Time off deletable by managers" ON public.time_off_requests;
CREATE POLICY "Time off deletable by managers"
  ON public.time_off_requests FOR DELETE
  TO authenticated
  USING (is_manager_or_owner());

