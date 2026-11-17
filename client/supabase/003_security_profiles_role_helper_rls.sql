-- Centralized role helper and profile access controls.
-- This migration is additive and intended to be reviewed in staging before production.
-- It does not change existing user data or allow general users to change their role.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
    ''
  );
$$;

ALTER FUNCTION public.get_current_user_role() OWNER TO postgres;

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Self read: only the user can read their own profile.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Self update: user can update their own non-role fields, but cannot change their own role.
DROP POLICY IF EXISTS profiles_update_own_non_role ON public.profiles;
CREATE POLICY profiles_update_own_non_role
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND NEW.role IS NOT DISTINCT FROM OLD.role
);

-- Admin full access: only the admin role can read or update all profiles.
DROP POLICY IF EXISTS profiles_admin_full_access ON public.profiles;
CREATE POLICY profiles_admin_full_access
ON public.profiles
FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

COMMIT;
