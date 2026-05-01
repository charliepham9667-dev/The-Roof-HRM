-- ============================================================================
-- Migration: profiles contract tracking fields
-- ============================================================================
-- Adds contract status fields to public.profiles so the Owner can track which
-- staff have signed/confirmed their contracts (Q2 2026 must-win: 13/13 staff
-- on signed 1-year contracts).
--
-- These columns are display-only — they do NOT auto-flow into pnl_monthly.
-- The owner continues to update payroll lines manually when contracts change.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contract_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_signed_date date,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS contract_type text;

COMMENT ON COLUMN public.profiles.contract_signed IS
  'Whether the staff member has signed their employment contract.';
COMMENT ON COLUMN public.profiles.contract_signed_date IS
  'Date the contract was physically signed (separate from start date).';
COMMENT ON COLUMN public.profiles.contract_start_date IS
  'Effective start date of the current contract.';
COMMENT ON COLUMN public.profiles.contract_end_date IS
  'Effective end date of the current contract. NULL = open-ended / not yet set.';
COMMENT ON COLUMN public.profiles.contract_type IS
  'Free-text contract type label (e.g. "1-year", "probation", "casual").';

CREATE INDEX IF NOT EXISTS profiles_contract_end_date_idx
  ON public.profiles (contract_end_date)
  WHERE contract_end_date IS NOT NULL;
