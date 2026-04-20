
-- 1. Add JA compliance fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trn text,
  ADD COLUMN IF NOT EXISTS nis_number text,
  ADD COLUMN IF NOT EXISTS nht_number text,
  ADD COLUMN IF NOT EXISTS paye_tax_code text,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS role_tier text,
  ADD COLUMN IF NOT EXISTS grade_step text,
  ADD COLUMN IF NOT EXISTS reporting_manager_id uuid;

-- ========== CREATE ALL TABLES FIRST ==========

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.statutory_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_type text NOT NULL,
  rate_value numeric NOT NULL,
  ceiling_amount numeric,
  effective_from date NOT NULL,
  expires_on date,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  level integer NOT NULL DEFAULT 0,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  department_id uuid REFERENCES public.departments(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  template_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id),
  pattern jsonb NOT NULL DEFAULT '{}',
  recurrence_rule text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shift_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  target_id uuid NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  shift_id uuid REFERENCES public.shifts(id),
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  break_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.break_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  break_type text NOT NULL DEFAULT 'rest',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  leave_type text NOT NULL DEFAULT 'vacation',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pto_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  year integer NOT NULL,
  total_days numeric NOT NULL DEFAULT 10,
  used_days numeric NOT NULL DEFAULT 0,
  carryover_days numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, year)
);

CREATE TABLE IF NOT EXISTS public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel_type text NOT NULL DEFAULT 'group',
  department_id uuid REFERENCES public.departments(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee_id uuid NOT NULL,
  shift_id uuid REFERENCES public.shifts(id),
  title text NOT NULL,
  description text,
  completed boolean NOT NULL DEFAULT false,
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  requester_id uuid NOT NULL,
  approver_id uuid,
  status text NOT NULL DEFAULT 'pending',
  sla_deadline timestamptz,
  escalation_path jsonb DEFAULT '[]',
  entity_type text,
  entity_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== ENABLE RLS ON ALL ==========
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statutory_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pto_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- ========== ALL RLS POLICIES ==========

-- feature_flags
CREATE POLICY "Anyone can read flags" ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage flags" ON public.feature_flags FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- statutory_rates
CREATE POLICY "Anyone can read rates" ON public.statutory_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rates" ON public.statutory_rates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- role_tiers
CREATE POLICY "Anyone can read tiers" ON public.role_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tiers" ON public.role_tiers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- shifts
CREATE POLICY "Employees see own shifts" ON public.shifts FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin/HR manage shifts" ON public.shifts FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- shift_templates
CREATE POLICY "Anyone can read templates" ON public.shift_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/HR manage templates" ON public.shift_templates FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- shift_swaps
CREATE POLICY "Users see own swaps" ON public.shift_swaps FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid() OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Users can request swaps" ON public.shift_swaps FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Admin/HR manage swaps" ON public.shift_swaps FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- availabilities
CREATE POLICY "Employees manage own availability" ON public.availabilities FOR ALL TO authenticated
  USING (employee_id = auth.uid() OR is_admin_or_hr(auth.uid())) WITH CHECK (employee_id = auth.uid() OR is_admin_or_hr(auth.uid()));

-- time_entries
CREATE POLICY "Employees see own entries" ON public.time_entries FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Employees create own entries" ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Admin/HR manage entries" ON public.time_entries FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- break_records
CREATE POLICY "Employees see own breaks" ON public.break_records FOR SELECT TO authenticated
  USING (time_entry_id IN (SELECT id FROM public.time_entries WHERE employee_id = auth.uid()) OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Employees create own breaks" ON public.break_records FOR INSERT TO authenticated
  WITH CHECK (time_entry_id IN (SELECT id FROM public.time_entries WHERE employee_id = auth.uid()));
CREATE POLICY "Admin/HR manage breaks" ON public.break_records FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- time_off_requests
CREATE POLICY "Employees see own requests" ON public.time_off_requests FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Employees create requests" ON public.time_off_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Admin/HR manage requests" ON public.time_off_requests FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- pto_allowances
CREATE POLICY "Employees see own PTO" ON public.pto_allowances FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin/HR manage PTO" ON public.pto_allowances FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- channels
CREATE POLICY "Members see channels" ON public.channels FOR SELECT TO authenticated
  USING (id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()) OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin/HR manage channels" ON public.channels FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- channel_members
CREATE POLICY "Members see own memberships" ON public.channel_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin/HR manage members" ON public.channel_members FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- messages
CREATE POLICY "Channel members read messages" ON public.messages FOR SELECT TO authenticated
  USING (channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()) OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Channel members send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()));

-- tasks
CREATE POLICY "Assignees see own tasks" ON public.tasks FOR SELECT TO authenticated
  USING (assignee_id = auth.uid() OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Assignees update own tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin/HR manage tasks" ON public.tasks FOR ALL TO authenticated
  USING (is_admin_or_hr(auth.uid())) WITH CHECK (is_admin_or_hr(auth.uid()));

-- approval_requests
CREATE POLICY "Requesters see own approvals" ON public.approval_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR approver_id = auth.uid() OR is_admin_or_hr(auth.uid()));
CREATE POLICY "Users create approval requests" ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Approvers/Admin manage approvals" ON public.approval_requests FOR UPDATE TO authenticated
  USING (approver_id = auth.uid() OR is_admin_or_hr(auth.uid()));

-- ========== REALTIME ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;

-- ========== TRIGGERS ==========
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON public.feature_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_statutory_rates_updated_at BEFORE UPDATE ON public.statutory_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_role_tiers_updated_at BEFORE UPDATE ON public.role_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_templates_updated_at BEFORE UPDATE ON public.shift_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_swaps_updated_at BEFORE UPDATE ON public.shift_swaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_availabilities_updated_at BEFORE UPDATE ON public.availabilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_off_requests_updated_at BEFORE UPDATE ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pto_allowances_updated_at BEFORE UPDATE ON public.pto_allowances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== AUDIT TRIGGER FUNCTION ==========
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
    jsonb_build_object(
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_shifts AFTER INSERT OR UPDATE OR DELETE ON public.shifts FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_time_entries AFTER INSERT OR UPDATE OR DELETE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_time_off_requests AFTER INSERT OR UPDATE OR DELETE ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER audit_payroll_records AFTER INSERT OR UPDATE OR DELETE ON public.payroll_records FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ========== SEED DATA ==========
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('enabled_ja_compliance', false, 'Enable Jamaican statutory compliance engine (TRN, NIS, NHT, PAYE)'),
  ('enabled_workforce_mgmt', false, 'Enable Sling-style workforce management (scheduling, time tracking, messaging)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.statutory_rates (rate_type, rate_value, ceiling_amount, effective_from, expires_on, description) VALUES
  ('nis_employee', 3.0, 5000000, '2024-04-01', NULL, 'NIS Employee contribution 3% up to J$5M ceiling'),
  ('nis_employer', 3.0, 5000000, '2024-04-01', NULL, 'NIS Employer contribution 3% up to J$5M ceiling'),
  ('nht_employee', 2.0, NULL, '2024-04-01', NULL, 'NHT Employee contribution 2%'),
  ('nht_employer', 3.0, NULL, '2024-04-01', NULL, 'NHT Employer contribution 3%'),
  ('education_tax_employee', 2.25, NULL, '2024-04-01', NULL, 'Education Tax Employee 2.25%'),
  ('education_tax_employer', 3.5, NULL, '2024-04-01', NULL, 'Education Tax Employer 3.5%'),
  ('paye_threshold', 1500096, NULL, '2024-04-01', NULL, 'PAYE Annual tax-free threshold J$1,500,096'),
  ('paye_rate_standard', 25.0, NULL, '2024-04-01', NULL, 'PAYE standard rate 25%'),
  ('paye_rate_upper', 30.0, NULL, '2024-04-01', NULL, 'PAYE upper rate 30% above J$6M'),
  ('paye_upper_threshold', 6000000, NULL, '2024-04-01', NULL, 'PAYE upper bracket threshold J$6M')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_tiers (name, level, description) VALUES
  ('ancillary', 1, 'Ancillary / support staff'),
  ('maintenance', 2, 'Maintenance and facilities'),
  ('admin_staff', 3, 'Administrative staff'),
  ('ict_tech', 4, 'ICT Technician'),
  ('ict_sysadmin', 5, 'ICT Systems Administrator'),
  ('ict_mgmt', 6, 'ICT Management'),
  ('faculty', 7, 'Faculty / Academic staff'),
  ('executive', 8, 'Executive leadership'),
  ('hr', 9, 'Human Resources')
ON CONFLICT (name) DO NOTHING;
