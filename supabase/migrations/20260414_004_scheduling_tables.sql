-- ============================================================
-- Migration: Scheduling & Workforce Management Tables
-- Purpose: Sling-style shift management, availability, time-off,
--          shift swaps, and scheduling rules
-- ============================================================

-- Shift status enum
DO $$ BEGIN
  CREATE TYPE public.shift_status AS ENUM ('draft', 'published', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Approval status enum (shared across time-off, shift swaps, timesheets)
DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'escalated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── SHIFTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id),
  title TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  status public.shift_status DEFAULT 'draft',
  template_id UUID,        -- references shift_templates if generated from one
  notes TEXT,
  color TEXT DEFAULT '#3b82f6', -- UI color for shift card
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_shift_times CHECK (end_time > start_time),
  CONSTRAINT chk_break_minutes CHECK (break_minutes >= 0)
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view own shifts" ON public.shifts
  FOR SELECT TO authenticated USING (employee_id = auth.uid());
CREATE POLICY "Manager view all shifts" ON public.shifts
  FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Manager manage shifts" ON public.shifts
  FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_shifts_employee ON public.shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_dept ON public.shifts(department_id);
CREATE INDEX IF NOT EXISTS idx_shifts_time ON public.shifts(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── SHIFT TEMPLATES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read templates" ON public.shift_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager manage templates" ON public.shift_templates
  FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- ── AVAILABILITIES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availabilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  expires_on DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own availability" ON public.availabilities
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own availability" ON public.availabilities
  FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Manager view all availability" ON public.availabilities
  FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_avail_user ON public.availabilities(user_id);

-- ── TIME-OFF REQUESTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL, -- 'vacation','sick','personal','maternity','paternity','bereavement','other'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status public.approval_status DEFAULT 'pending',
  approver_id UUID REFERENCES auth.users(id),
  notes TEXT,
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own time-off" ON public.time_off_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own time-off" ON public.time_off_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Manager view all time-off" ON public.time_off_requests
  FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Manager manage time-off" ON public.time_off_requests
  FOR UPDATE TO authenticated USING (public.is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_timeoff_user ON public.time_off_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_timeoff_status ON public.time_off_requests(status);

-- ── SHIFT SWAPS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_swaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  target_employee_id UUID NOT NULL REFERENCES auth.users(id),
  status public.approval_status DEFAULT 'pending',
  manager_id UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own swaps" ON public.shift_swaps
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR target_employee_id = auth.uid());
CREATE POLICY "Manager view all swaps" ON public.shift_swaps
  FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Users create swaps" ON public.shift_swaps
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Manager manage swaps" ON public.shift_swaps
  FOR UPDATE TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- ── SCHEDULING RULES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduling_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type TEXT NOT NULL,
    -- 'max_shift_hours', 'min_break_minutes', 'overtime_weekly_threshold',
    -- 'max_consecutive_days', 'budget_cap_weekly'
  value NUMERIC NOT NULL,
  department_id UUID REFERENCES public.departments(id), -- NULL = global rule
  effective_from DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scheduling_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read rules" ON public.scheduling_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage rules" ON public.scheduling_rules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed default JA labor law rules
INSERT INTO public.scheduling_rules (rule_type, value, notes) VALUES
  ('max_shift_hours', 8, 'JA labour law: standard 8-hour shift'),
  ('min_break_minutes', 60, 'JA labour law: minimum 1hr rest after 5 consecutive hours'),
  ('overtime_weekly_threshold', 40, 'Overtime kicks in above 40 hours/week'),
  ('max_consecutive_days', 6, 'Maximum 6 consecutive working days')
ON CONFLICT DO NOTHING;

-- ── LEAVE BALANCES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  total_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  carried_over NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, leave_type, year)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own balance" ON public.leave_balances
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Manager view all balances" ON public.leave_balances
  FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Manager manage balances" ON public.leave_balances
  FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
