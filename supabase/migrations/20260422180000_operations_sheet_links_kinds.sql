-- Historical migration kept to match remote migration history.
-- This version was already applied remotely on 2026-04-22.
--
-- It expanded allowed `kind` values in operations_sheet_links.
-- Even if current workflow no longer uses these kinds, keep this file so
-- Supabase migration version tracking stays consistent across environments.

ALTER TABLE public.operations_sheet_links
  DROP CONSTRAINT IF EXISTS operations_sheet_links_kind_check;

ALTER TABLE public.operations_sheet_links
  ADD CONSTRAINT operations_sheet_links_kind_check
  CHECK (
    kind IN (
      'purchase_request',
      'payment_request',
      'inventory',
      'sales',
      'pnl',
      'salary',
      'calendar',
      'cash_position',
      'supplier_debt'
    )
  );
