-- ============================================================
-- Migration: Feature Flags
-- Purpose: Config table for gated feature rollout
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read flags"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage flags"
  ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('enabled_ja_compliance', false, 'Jamaican statutory compliance engine (TRN/NIS/NHT/PAYE fields + statutory deduction calculator)'),
  ('enabled_workforce_mgmt', false, 'Sling-style scheduling, shift management, and workforce time tracking'),
  ('enabled_messaging', false, 'Team communication hub with department-scoped channels'),
  ('enabled_reporting', false, 'Advanced labor reports, forecasting, and budget guardrails')
ON CONFLICT (key) DO NOTHING;
