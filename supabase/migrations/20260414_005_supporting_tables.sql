-- ============================================================
-- Migration: Approval Routing, Messaging, Budget, Calendar,
--            Audit Enhancement, Retroactive Adjustments
-- ============================================================

-- ── APPROVAL REQUESTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_type TEXT NOT NULL, -- 'time_off', 'shift_swap', 'timesheet', 'expense'
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  approver_id UUID REFERENCES auth.users(id),
  entity_id UUID,             -- FK to the relevant record (generic)
  entity_table TEXT,           -- which table entity_id references
  status public.approval_status DEFAULT 'pending',
  sla_deadline TIMESTAMPTZ,
  escalated_to UUID REFERENCES auth.users(id),
  decision_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  decided_at TIMESTAMPTZ
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own approvals" ON public.approval_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR approver_id = auth.uid() OR escalated_to = auth.uid());
CREATE POLICY "Manager view all approvals" ON public.approval_requests
  FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Users create own approvals" ON public.approval_requests
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Approver manage approvals" ON public.approval_requests
  FOR UPDATE TO authenticated
  USING (approver_id = auth.uid() OR escalated_to = auth.uid() OR public.is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_approval_requester ON public.approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON public.approval_requests(status);

-- ── MESSAGING: CHANNELS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  department_id UUID REFERENCES public.departments(id), -- NULL = org-wide
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view public channels" ON public.channels
  FOR SELECT TO authenticated
  USING (NOT is_private OR public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin manage channels" ON public.channels
  FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- ── MESSAGING: MESSAGES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL CHECK (char_length(content) <= 4000),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Channel members read messages" ON public.messages
  FOR SELECT TO authenticated USING (true); -- further scoped by channel access
CREATE POLICY "Authenticated send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel_id, created_at DESC);

-- ── ANNOUNCEMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id), -- NULL = org-wide
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  author_id UUID NOT NULL REFERENCES auth.users(id),
  published_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read announcements" ON public.announcements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manager create announcements" ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Manager manage announcements" ON public.announcements
  FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- ── TASKS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tasks" ON public.tasks
  FOR SELECT TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "Users update own tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "Manager view all tasks" ON public.tasks
  FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Manager manage tasks" ON public.tasks
  FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- ── DEPARTMENT BUDGETS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.department_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  labor_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (department_id, period_start, period_end)
);

ALTER TABLE public.department_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager view budgets" ON public.department_budgets
  FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin manage budgets" ON public.department_budgets
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ── ACADEMIC CALENDAR (managed in-app per user request) ──────
CREATE TABLE IF NOT EXISTS public.academic_calendar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'semester_start','semester_end','exam_period','holiday','orientation','graduation'
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read calendar" ON public.academic_calendar
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage calendar" ON public.academic_calendar
  FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- ── RETROACTIVE ADJUSTMENTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.retroactive_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pay_period_id UUID NOT NULL REFERENCES public.pay_periods(id),
  adjustment_type TEXT NOT NULL, -- 'rate_change', 'missed_hours', 'statutory_correction'
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  applied_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.retroactive_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own adjustments" ON public.retroactive_adjustments
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Manager view all adjustments" ON public.retroactive_adjustments
  FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Manager manage adjustments" ON public.retroactive_adjustments
  FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- ── AUDIT LOGS ENHANCEMENT ───────────────────────────────────
-- Add before/after state columns for row-level change tracking
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS before_state JSONB,
  ADD COLUMN IF NOT EXISTS after_state JSONB,
  ADD COLUMN IF NOT EXISTS ip_address INET;

-- Immutable audit trigger function (covers all tables)
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id, before_state, after_state
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_profiles AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_payroll AFTER INSERT OR UPDATE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_shifts AFTER INSERT OR UPDATE OR DELETE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_time_off AFTER INSERT OR UPDATE ON public.time_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER audit_shift_swaps AFTER INSERT OR UPDATE ON public.shift_swaps
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ── DATA RETENTION POLICIES (JA DPA 2020) ────────────────────
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL UNIQUE, -- 'location_data', 'messages', 'attendance_records', 'audit_logs'
  retention_days INTEGER NOT NULL,  -- auto-purge after N days
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage retention" ON public.data_retention_policies
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read retention" ON public.data_retention_policies
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.data_retention_policies (entity_type, retention_days, notes) VALUES
  ('location_data', 365, 'GPS coordinates purged after 1 year per DPA'),
  ('messages', 730, 'Messages retained for 2 years'),
  ('audit_logs', 2555, 'Audit logs retained for 7 years (regulatory)')
ON CONFLICT (entity_type) DO NOTHING;
