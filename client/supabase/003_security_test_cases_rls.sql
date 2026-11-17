-- Migration 003: Replace permissive test case access with owner/admin rules.
-- Problem:
--   If previous policies allow `authenticated` users to view or edit test cases broadly, a user could modify another user’s records.
-- Safety:
--   This migration removes all existing policies for public.test_cases before recreating a strict set.

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
  _table_exists boolean;
  _owner_col text;
  _policy record;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'test_cases'
  ) INTO _table_exists;

  IF NOT _table_exists THEN
    RAISE NOTICE 'Skipping test_case RLS: public.test_cases does not exist.';
    RETURN;
  END IF;

  FOR _policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_cases'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.test_cases', _policy.policyname);
  END LOOP;

  SELECT column_name INTO _owner_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'test_cases'
    AND column_name IN ('created_by', 'tester_id', 'owner_id', 'user_id')
  ORDER BY CASE column_name
    WHEN 'created_by' THEN 1
    WHEN 'tester_id' THEN 2
    WHEN 'owner_id' THEN 3
    WHEN 'user_id' THEN 4
    ELSE 5
  END
  LIMIT 1;

  IF _owner_col IS NULL THEN
    RAISE NOTICE 'Skipping test_case RLS: no supported ownership column found on public.test_cases.';
    RETURN;
  END IF;

  ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;

  EXECUTE format(
    'CREATE POLICY test_cases_select_own ON public.test_cases FOR SELECT TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L)',
    _owner_col,
    'admin'
  );

  EXECUTE format(
    'CREATE POLICY test_cases_insert_own ON public.test_cases FOR INSERT TO authenticated WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)',
    _owner_col,
    'admin'
  );

  EXECUTE format(
    'CREATE POLICY test_cases_update_own ON public.test_cases FOR UPDATE TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L) WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)',
    _owner_col,
    'admin',
    _owner_col,
    'admin'
  );

  EXECUTE format(
    'CREATE POLICY test_cases_delete_own ON public.test_cases FOR DELETE TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L)',
    _owner_col,
    'admin'
  );
END $$;

COMMIT;
