
-- 1. FIX: Privilege escalation on user_roles
-- Drop the ALL policy and replace with explicit per-operation policies
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;

CREATE POLICY "Admin can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. FIX: Profile self-update policy targets public role, should be authenticated
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 3. FIX: Geofence location data visible to all authenticated users
-- Replace open SELECT with scoped policy
DROP POLICY IF EXISTS "Authenticated can view geofences" ON public.geofences;

CREATE POLICY "Users view assigned geofences"
ON public.geofences
FOR SELECT
TO authenticated
USING (
  is_admin_or_hr(auth.uid())
  OR id IN (
    SELECT eg.geofence_id FROM public.employee_geofences eg
    JOIN public.profiles p ON p.id = eg.employee_id
    WHERE p.user_id = auth.uid()
  )
);
