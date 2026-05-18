-- Add 'dividend' as a valid category for supplier debt items
ALTER TABLE public.finance_supplier_debt_items
  DROP CONSTRAINT IF EXISTS finance_supplier_debt_items_category_check;

ALTER TABLE public.finance_supplier_debt_items
  ADD CONSTRAINT finance_supplier_debt_items_category_check
    CHECK (category IN ('inventory', 'rent', 'capex', 'utilities', 'dividend', 'other'));
