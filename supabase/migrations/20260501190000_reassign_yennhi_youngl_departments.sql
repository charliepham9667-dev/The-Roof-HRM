-- Move two staff members to their correct departments.
--
-- Charlie's instruction (2026-05-01):
--   • Yen Nhi  → Marketing
--   • YoungL   → Service
--
-- Defensive: each UPDATE only runs when EXACTLY ONE active profile matches
-- the name. If zero or multiple match, a NOTICE is raised and nothing changes,
-- so we never silently re-assign the wrong person.

DO $$
DECLARE
  v_count int;
  v_id    uuid;
BEGIN
  -- ── Yen Nhi → Marketing ───────────────────────────────────────────────
  SELECT count(*) INTO v_count
  FROM public.profiles
  WHERE full_name ILIKE '%yen%nhi%';

  IF v_count = 1 THEN
    UPDATE public.profiles
       SET department = 'Marketing',
           updated_at = now()
     WHERE full_name ILIKE '%yen%nhi%'
     RETURNING id INTO v_id;
    RAISE NOTICE 'Yen Nhi (id=%) moved to Marketing', v_id;
  ELSE
    RAISE NOTICE 'Skipped Yen Nhi: % profiles matched (need exactly 1)', v_count;
  END IF;

  -- ── YoungL → Service ─────────────────────────────────────────────────
  -- "YoungL" is a single token (no space). Try literal first, then a
  -- "young l" fallback in case the stored name has a space.
  SELECT count(*) INTO v_count
  FROM public.profiles
  WHERE full_name ILIKE 'youngl%' OR full_name ILIKE 'young l%';

  IF v_count = 1 THEN
    UPDATE public.profiles
       SET department = 'Service',
           updated_at = now()
     WHERE full_name ILIKE 'youngl%' OR full_name ILIKE 'young l%'
     RETURNING id INTO v_id;
    RAISE NOTICE 'YoungL (id=%) moved to Service', v_id;
  ELSE
    RAISE NOTICE 'Skipped YoungL: % profiles matched (need exactly 1)', v_count;
  END IF;
END $$;
