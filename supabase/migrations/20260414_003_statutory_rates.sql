-- ============================================================
-- Migration: Statutory Rates Table
-- Purpose: Date-stamped JA tax/deduction rates (never hardcoded)
-- Seeded with 2024/2025 rates per user confirmation
-- ============================================================

CREATE TABLE IF NOT EXISTS public.statutory_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_type TEXT NOT NULL,
    -- Values: 'nis_employee', 'nis_employer', 'nht', 'education_tax', 'paye_25', 'paye_30'
  rate NUMERIC(8,6) NOT NULL,        -- e.g. 0.030000 = 3%
  ceiling NUMERIC(12,2),             -- max earnings subject to this rate (NULL = no ceiling)
  threshold NUMERIC(12,2) DEFAULT 0, -- income threshold for bracket (PAYE)
  effective_from DATE NOT NULL,
  expires_on DATE,                   -- NULL = currently active
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.statutory_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read rates"
  ON public.statutory_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage rates"
  ON public.statutory_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_statutory_rates_lookup
  ON public.statutory_rates(rate_type, effective_from);

-- ── Seed 2024/2025 Jamaican Statutory Rates ──────────────────
-- Source: Tax Administration Jamaica / Ministry of Finance
INSERT INTO public.statutory_rates (rate_type, rate, ceiling, threshold, effective_from, notes) VALUES
  -- NIS: 3% employee contribution, ceiling J$5,000,000/yr
  ('nis_employee', 0.030000, 5000000, 0, '2024-04-01',
   'NIS employee contribution 3%, annual ceiling J$5,000,000'),

  -- NIS: 3% employer contribution (matched)
  ('nis_employer', 0.030000, 5000000, 0, '2024-04-01',
   'NIS employer contribution 3%, annual ceiling J$5,000,000'),

  -- NHT: 2% of gross emoluments, no ceiling
  ('nht', 0.020000, NULL, 0, '2024-04-01',
   'NHT 2% of gross emoluments, no ceiling'),

  -- Education Tax: 2.25% employee
  ('education_tax', 0.022500, NULL, 0, '2024-04-01',
   'Education Tax 2.25% employee share'),

  -- PAYE: 25% on annual income above J$1,500,096 (first bracket)
  ('paye_25', 0.250000, 6000000, 1500096, '2024-04-01',
   'PAYE 25% on income between J$1,500,096 and J$6,000,000/yr'),

  -- PAYE: 30% on annual income above J$6,000,000 (second bracket)
  ('paye_30', 0.300000, NULL, 6000000, '2024-04-01',
   'PAYE 30% on income above J$6,000,000/yr')
ON CONFLICT DO NOTHING;
