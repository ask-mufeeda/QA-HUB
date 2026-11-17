-- Migration 001: Replace permissive bug access with explicit owner/assignee/admin rules.
-- Problem:
--   Bug policies may be permissive (`TRUE`, `authenticated`, or broad `FOR ALL`) and allow cross-user reads.
--   This migration removes conflicting policies first, then recreates a safe policy set.
-- Safety:
--   No data is deleted. Existing records remain untouched.

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
  _assignee_col text;
  _policy record;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bugs'
  ) INTO _table_exists;

  IF NOT _table_exists THEN
    RAISE NOTICE 'Skipping bug RLS: public.bugs does not exist.';
    RETURN;
  END IF;

  FOR _policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bugs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bugs', _policy.policyname);
  END LOOP;

  SELECT column_name INTO _owner_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'bugs'
    AND column_name IN ('created_by', 'user_id', 'owner_id')
  ORDER BY CASE column_name
    WHEN 'created_by' THEN 1
    WHEN 'user_id' THEN 2
    WHEN 'owner_id' THEN 3
    ELSE 4
  END
  LIMIT 1;

  SELECT column_name INTO _assignee_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'bugs'
    AND column_name IN ('assigned_to', 'assignee_id', 'developer_id')
  ORDER BY CASE column_name
    WHEN 'assigned_to' THEN 1
    WHEN 'assignee_id' THEN 2
    WHEN 'developer_id' THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF _owner_col IS NULL THEN
    RAISE NOTICE 'Skipping bug policy replacement: no supported owner column was found on public.bugs.';
    RETURN;
  END IF;

  ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;

  EXECUTE format(
    'CREATE POLICY bugs_select_own_or_assigned ON public.bugs FOR SELECT TO authenticated USING (%I = auth.uid() %s OR public.get_current_user_role() = %L)',
    _owner_col,
    CASE WHEN _assignee_col IS NULL THEN '' ELSE format(' OR %I = auth.uid()', _assignee_col) END,
    'admin'
  );

  EXECUTE format(
    'CREATE POLICY bugs_insert_own ON public.bugs FOR INSERT TO authenticated WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)',
    _owner_col,
    'admin'
  );

  EXECUTE format(
    'CREATE POLICY bugs_update_own_or_assigned ON public.bugs FOR UPDATE TO authenticated USING (%I = auth.uid() %s OR public.get_current_user_role() = %L) WITH CHECK (%I = auth.uid() %s OR public.get_current_user_role() = %L)',
    _owner_col,
    CASE WHEN _assignee_col IS NULL THEN '' ELSE format(' OR %I = auth.uid()', _assignee_col) END,
    'admin',
    _owner_col,
    CASE WHEN _assignee_col IS NULL THEN '' ELSE format(' OR %I = auth.uid()', _assignee_col) END,
    'admin'
  );

  EXECUTE format(
    'CREATE POLICY bugs_delete_own_or_admin ON public.bugs FOR DELETE TO authenticated USING (%I = auth.uid() %s OR public.get_current_user_role() = %L)',
    _owner_col,
    CASE WHEN _assignee_col IS NULL THEN '' ELSE format(' OR %I = auth.uid()', _assignee_col) END,
    'admin'
  );
END $$;

COMMIT;
