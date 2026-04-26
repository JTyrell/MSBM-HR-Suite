-- 1. Fix announcements policy: restrict to authenticated role only
DROP POLICY IF EXISTS "Admins and HR can manage announcements" ON public.announcements;
CREATE POLICY "Admins and HR can manage announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (is_admin_or_hr(auth.uid()))
WITH CHECK (is_admin_or_hr(auth.uid()));

-- Same for leave_balances (also uses public role)
DROP POLICY IF EXISTS "Admins and HR can manage leave balances" ON public.leave_balances;
CREATE POLICY "Admins and HR can manage leave balances"
ON public.leave_balances
FOR ALL
TO authenticated
USING (is_admin_or_hr(auth.uid()))
WITH CHECK (is_admin_or_hr(auth.uid()));

DROP POLICY IF EXISTS "Users can view their own leave balances" ON public.leave_balances;
CREATE POLICY "Users can view their own leave balances"
ON public.leave_balances
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR is_admin_or_hr(auth.uid()));

-- 2. Extend profiles_self_update trigger to cover all sensitive HR + JA fields
CREATE OR REPLACE FUNCTION public.profiles_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_or_hr(auth.uid()) THEN
    NEW.pay_rate := OLD.pay_rate;
    NEW.pay_type := OLD.pay_type;
    NEW.status := OLD.status;
    NEW.department_id := OLD.department_id;
    NEW.hire_date := OLD.hire_date;
    NEW.email := OLD.email;
    NEW.user_id := OLD.user_id;
    NEW.trn := OLD.trn;
    NEW.nis_number := OLD.nis_number;
    NEW.nht_number := OLD.nht_number;
    NEW.paye_tax_code := OLD.paye_tax_code;
    NEW.role_tier := OLD.role_tier;
    NEW.grade_step := OLD.grade_step;
    NEW.contract_type := OLD.contract_type;
    NEW.reporting_manager_id := OLD.reporting_manager_id;
    NEW.job_title := OLD.job_title;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_self_update_guard ON public.profiles;
CREATE TRIGGER profiles_self_update_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_self_update();
