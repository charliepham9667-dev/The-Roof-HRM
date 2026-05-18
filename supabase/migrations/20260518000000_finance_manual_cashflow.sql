-- Manual cash-flow log: record any one-off transaction that isn't tied to
-- daily revenue (daily_metrics) or a supplier debt payment (finance_supplier_debt_items).
-- Examples: owner dividends, salary runs, one-time capex payments, cash top-ups.

CREATE TABLE IF NOT EXISTS public.finance_manual_cashflow (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_date       DATE        NOT NULL,
  direction       TEXT        NOT NULL CHECK (direction IN ('in', 'out')),
  amount_vnd      BIGINT      NOT NULL CHECK (amount_vnd > 0),
  category        TEXT        NOT NULL DEFAULT 'other'
                              CHECK (category IN ('dividend','salary','rent','inventory','capex','utilities','other')),
  description     TEXT        NOT NULL DEFAULT '',
  notes           TEXT,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_manual_cashflow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manual cashflow viewable by authenticated"
  ON public.finance_manual_cashflow FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Manual cashflow writable by owner/manager"
  ON public.finance_manual_cashflow FOR ALL
  TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','manager')));

CREATE INDEX IF NOT EXISTS finance_manual_cashflow_flow_date_idx
  ON public.finance_manual_cashflow (flow_date);
