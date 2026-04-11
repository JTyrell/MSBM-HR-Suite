
-- Drop the overly permissive self-update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create a restricted self-update policy using a security definer function
-- that only allows updating non-sensitive columns
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
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to enforce field restrictions before update
CREATE TRIGGER enforce_profile_field_restrictions
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_self_update();

-- Re-create the self-update policy (row-level access only, field restrictions handled by trigger)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);
