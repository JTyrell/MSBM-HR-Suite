-- ============================================================
-- Migration: JA Compliance Fields on Profiles
-- Purpose: MyHR+ / HRplus data parity for Jamaican HRIS
-- Notes:
--   - ict_tsr = ICT student interns (TSR), exempt from PAYE
--     until monthly income exceeds personal threshold
--   - All columns nullable for backward compatibility
--   - TRN: exactly 9 digits; NIS: XX-XXXXXX-X format
-- ============================================================

-- PAYE tax code enum (Jamaican standard)
DO $$ BEGIN
  CREATE TYPE public.paye_tax_code AS ENUM ('A', 'B', 'C', 'D', 'E');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Contract type enum
DO $$ BEGIN
  CREATE TYPE public.contract_type AS ENUM ('permanent', 'contract', 'temporary', 'probation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- University role tier enum
-- NOTE: ict_tsr (not ict_tech) = student interns working for internal staff
-- They are officially student interns and are PAYE-exempt below monthly threshold
DO $$ BEGIN
  CREATE TYPE public.role_tier AS ENUM (
    'ancillary',
    'maintenance',
    'admin_staff',
    'ict_tsr',        -- ICT Student Intern (TSR) — PAYE exempt below threshold
    'ict_sysadmin',
    'ict_mgmt',
    'faculty',
    'executive',
    'hr'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add JA compliance columns to profiles (all nullable = zero breakage)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trn CHAR(9),
  ADD COLUMN IF NOT EXISTS nis_number VARCHAR(12),
  ADD COLUMN IF NOT EXISTS nht_number TEXT,
  ADD COLUMN IF NOT EXISTS paye_tax_code public.paye_tax_code,
  ADD COLUMN IF NOT EXISTS contract_type public.contract_type,
  ADD COLUMN IF NOT EXISTS role_tier public.role_tier,
  ADD COLUMN IF NOT EXISTS grade TEXT,
  ADD COLUMN IF NOT EXISTS step INTEGER,
  ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS location_consent BOOLEAN DEFAULT false;

-- TRN format constraint: exactly 9 digits
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT chk_trn_format CHECK (trn IS NULL OR trn ~ '^\d{9}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NIS format constraint: XX-XXXXXX-X (2 digits, dash, 6 digits, dash, 1 digit)
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT chk_nis_format CHECK (
      nis_number IS NULL OR nis_number ~ '^\d{2}-\d{6}-\d$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_profiles_role_tier ON public.profiles(role_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_reports_to ON public.profiles(reports_to);
CREATE INDEX IF NOT EXISTS idx_profiles_contract_type ON public.profiles(contract_type);
CREATE INDEX IF NOT EXISTS idx_profiles_trn ON public.profiles(trn) WHERE trn IS NOT NULL;

-- Update the profiles_self_update trigger to also protect new sensitive fields
CREATE OR REPLACE FUNCTION public.profiles_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the user is not admin/hr, prevent changes to sensitive fields
  IF NOT is_admin_or_hr(auth.uid()) THEN
    NEW.pay_rate := OLD.pay_rate;
    NEW.pay_type := OLD.pay_type;
    NEW.status := OLD.status;
    NEW.department_id := OLD.department_id;
    NEW.hire_date := OLD.hire_date;
    NEW.email := OLD.email;
    NEW.user_id := OLD.user_id;
    -- Protect JA compliance fields from self-edit
    NEW.trn := OLD.trn;
    NEW.nis_number := OLD.nis_number;
    NEW.nht_number := OLD.nht_number;
    NEW.paye_tax_code := OLD.paye_tax_code;
    NEW.contract_type := OLD.contract_type;
    NEW.role_tier := OLD.role_tier;
    NEW.grade := OLD.grade;
    NEW.step := OLD.step;
    NEW.reports_to := OLD.reports_to;
  END IF;
  RETURN NEW;
END;
$$;
