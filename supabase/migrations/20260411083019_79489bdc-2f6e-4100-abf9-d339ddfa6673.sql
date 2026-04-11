
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'hr_manager', 'employee');

-- Create pay type enum
CREATE TYPE public.pay_type AS ENUM ('hourly', 'salary');

-- Create attendance status enum
CREATE TYPE public.attendance_status AS ENUM ('valid', 'invalid', 'pending');

-- Create pay period status enum
CREATE TYPE public.pay_period_status AS ENUM ('draft', 'processing', 'completed', 'cancelled');

-- Departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  department_id UUID REFERENCES public.departments(id),
  job_title TEXT,
  pay_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  pay_type public.pay_type NOT NULL DEFAULT 'hourly',
  hire_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Geofences table (store polygon as JSONB for simplicity, validate in edge functions)
CREATE TABLE public.geofences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  polygon JSONB NOT NULL, -- GeoJSON polygon coordinates
  latitude NUMERIC(10,7) NOT NULL, -- center point for map display
  longitude NUMERIC(10,7) NOT NULL,
  radius_meters NUMERIC(10,2) DEFAULT 100,
  department_id UUID REFERENCES public.departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employee geofences junction
CREATE TABLE public.employee_geofences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  geofence_id UUID NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, geofence_id)
);

-- Attendance records
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  clock_in_lat NUMERIC(10,7) NOT NULL,
  clock_in_lng NUMERIC(10,7) NOT NULL,
  clock_out_lat NUMERIC(10,7),
  clock_out_lng NUMERIC(10,7),
  geofence_id UUID REFERENCES public.geofences(id),
  status public.attendance_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pay periods
CREATE TABLE public.pay_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pay_date DATE,
  status public.pay_period_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payroll records
CREATE TABLE public.payroll_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pay_period_id UUID NOT NULL REFERENCES public.pay_periods(id) ON DELETE CASCADE,
  regular_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  pay_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  gross_pay NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_deductions NUMERIC(10,2) NOT NULL DEFAULT 0,
  benefit_deductions NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pay_period_id)
);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is admin or hr_manager
CREATE OR REPLACE FUNCTION public.is_admin_or_hr(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'hr_manager')
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_geofences_updated_at BEFORE UPDATE ON public.geofences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pay_periods_updated_at BEFORE UPDATE ON public.pay_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON public.payroll_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  -- Assign default 'employee' role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Departments: everyone can read, admins can manage
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: users see own, admins/hr see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin/HR can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin/HR can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- User roles: users see own, admins manage all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Geofences: authenticated can read, admins manage
CREATE POLICY "Authenticated can view geofences" ON public.geofences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage geofences" ON public.geofences FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Employee geofences: users see own, admins manage
CREATE POLICY "Users see own geofence assignments" ON public.employee_geofences FOR SELECT TO authenticated
  USING (employee_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Admins manage geofence assignments" ON public.employee_geofences FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Attendance: users see own, admins/hr see all
CREATE POLICY "Users view own attendance" ON public.attendance_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin/HR view all attendance" ON public.attendance_records FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Users can clock in" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can clock out" ON public.attendance_records FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin/HR can update attendance" ON public.attendance_records FOR UPDATE TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Pay periods: authenticated can read, admins manage
CREATE POLICY "Authenticated view pay periods" ON public.pay_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage pay periods" ON public.pay_periods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Payroll records: users see own, admins/hr see all
CREATE POLICY "Users view own payroll" ON public.payroll_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin/HR view all payroll" ON public.payroll_records FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin/HR manage payroll" ON public.payroll_records FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_department ON public.profiles(department_id);
CREATE INDEX idx_attendance_user_id ON public.attendance_records(user_id);
CREATE INDEX idx_attendance_clock_in ON public.attendance_records(clock_in);
CREATE INDEX idx_attendance_status ON public.attendance_records(status);
CREATE INDEX idx_payroll_user_period ON public.payroll_records(user_id, pay_period_id);
CREATE INDEX idx_geofences_active ON public.geofences(is_active);
CREATE INDEX idx_employee_geofences_employee ON public.employee_geofences(employee_id);
