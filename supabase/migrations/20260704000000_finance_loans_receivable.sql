-- Loans receivable: money The Roof has lent OUT and expects back.
-- Mirrors finance_supplier_debt_items (money we owe) on the other side of the ledger.
-- First case: 500M VND loaned to East West Mui Ne (NHBB Mũi Né) on 2026-07-03,
-- 12%/year for 6 months -> 30M interest, 530M total due 2027-01-03.

CREATE TABLE IF NOT EXISTS public.finance_loans_receivable (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower              TEXT        NOT NULL,
  principal_vnd         BIGINT      NOT NULL CHECK (principal_vnd > 0),
  interest_rate_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,  -- annual rate
  start_date            DATE        NOT NULL,
  maturity_date         DATE        NOT NULL,
  expected_interest_vnd BIGINT      NOT NULL DEFAULT 0,
  status                TEXT        NOT NULL DEFAULT 'outstanding'
                                    CHECK (status IN ('outstanding', 'repaid')),
  repaid_at             DATE,
  repaid_amount_vnd     BIGINT,
  notes                 TEXT,
  contract_file_path    TEXT,
  contract_file_name    TEXT,
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_loans_receivable_maturity
  ON public.finance_loans_receivable (maturity_date);

ALTER TABLE public.finance_loans_receivable ENABLE ROW LEVEL SECURITY;

-- Same access model as finance_cash_position_daily: owner/admin only.
DROP POLICY IF EXISTS "finance_loans_receivable_select" ON public.finance_loans_receivable;
CREATE POLICY "finance_loans_receivable_select" ON public.finance_loans_receivable
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "finance_loans_receivable_write" ON public.finance_loans_receivable;
CREATE POLICY "finance_loans_receivable_write" ON public.finance_loans_receivable
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_active = true
        AND (p.role = 'owner' OR p.role = 'admin')
    )
  );

-- Seed the East West Mui Ne loan (contract signed 03.07.2026).
INSERT INTO public.finance_loans_receivable
  (borrower, principal_vnd, interest_rate_pct, start_date, maturity_date,
   expected_interest_vnd, status, notes)
SELECT
  'East West Mui Ne (NHBB Mũi Né)',
  500000000,
  12.00,
  '2026-07-03',
  '2027-01-03',
  30000000,
  'outstanding',
  'Loan contract dated 03.07.2026. 12%/year over 6 months. Repayment due: 530M VND (500M principal + 30M interest). Cash left MB account on 03 Jul (visible in the daily cash position drop of 500M).'
WHERE NOT EXISTS (
  SELECT 1 FROM public.finance_loans_receivable
  WHERE borrower = 'East West Mui Ne (NHBB Mũi Né)'
    AND start_date = '2026-07-03'
);
