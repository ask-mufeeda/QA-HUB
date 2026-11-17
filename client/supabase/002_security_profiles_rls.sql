-- Migration 002: Restrict profile access and block self-role escalation without using invalid policy expressions.
-- Problem:
--   The previous profile policy attempted to compare NEW.role / OLD.role inside an RLS policy, which is invalid.
--   Use a trigger to block role changes instead.
-- Safety:
--   This script removes all conflicting profile policies and then recreates a safe policy set.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_current_user_role'
  ) THEN
    CREATE FUNCTION public.get_current_user_role()
    RETURNS text
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public, pg_catalog, auth
    AS $$
      SELECT COALESCE(
        (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
        ''
      );
    $$;
  END IF;
END $$;

DO $$
DECLARE
  _profiles_exists boolean;
  _role_exists boolean;
  _policy record;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO _profiles_exists;

  IF NOT _profiles_exists THEN
    RAISE NOTICE 'Skipping profile RLS: public.profiles does not exist.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) INTO _role_exists;

  IF NOT _role_exists THEN
    RAISE NOTICE 'Skipping profile RLS: public.profiles.role does not exist.';
    RETURN;
  END IF;

  FOR _policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', _policy.policyname);
  END LOOP;

  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

  CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.get_current_user_role() = 'admin');

  CREATE POLICY profiles_update_own_non_role
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.get_current_user_role() = 'admin')
  WITH CHECK (id = auth.uid());

  CREATE POLICY profiles_admin_full_access
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() = 'admin')
  WITH CHECK (public.get_current_user_role() = 'admin');
END $$;

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, auth
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.id = OLD.id AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() = OLD.id THEN
      RAISE EXCEPTION 'You cannot change your own role.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();

COMMIT;
