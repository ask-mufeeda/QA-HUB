-- Migration 004: Replace permissive automation access with owner/admin rules.
-- Problem:
--   The previous automation_results policy assumed `automation_runs.created_by` only.
--   The live schema may use `owner_id` or `user_id`, so the policy must be detected dynamically.
-- Safety:
--   This migration removes existing automation policies and recreates them using the actual owner column.

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
  _table_name text;
  _owner_col text;
  _policy record;
BEGIN
  FOR _table_name IN 'automation_projects', 'automation_suites', 'automation_scripts', 'automation_executions', 'automation_execution_results', 'automation_runs', 'automation_results'
  LOOP
    IF to_regclass('public.' || _table_name) IS NULL THEN
      CONTINUE;
    END IF;

    FOR _policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = _table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _policy.policyname, _table_name);
    END LOOP;
  END LOOP;

  -- automation_projects
  IF to_regclass('public.automation_projects') IS NOT NULL THEN
    SELECT column_name INTO _owner_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_projects'
      AND column_name IN ('owner_id', 'created_by', 'user_id')
    ORDER BY CASE column_name WHEN 'owner_id' THEN 1 WHEN 'created_by' THEN 2 WHEN 'user_id' THEN 3 ELSE 4 END
    LIMIT 1;

    IF _owner_col IS NOT NULL THEN
      ALTER TABLE public.automation_projects ENABLE ROW LEVEL SECURITY;
      EXECUTE format('CREATE POLICY automation_projects_owner_access ON public.automation_projects FOR ALL TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L) WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)', _owner_col, 'admin', _owner_col, 'admin');
    END IF;
  END IF;

  -- automation_suites
  IF to_regclass('public.automation_suites') IS NOT NULL THEN
    SELECT column_name INTO _owner_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_suites'
      AND column_name IN ('owner_id', 'created_by', 'user_id')
    ORDER BY CASE column_name WHEN 'owner_id' THEN 1 WHEN 'created_by' THEN 2 WHEN 'user_id' THEN 3 ELSE 4 END
    LIMIT 1;

    IF _owner_col IS NOT NULL THEN
      ALTER TABLE public.automation_suites ENABLE ROW LEVEL SECURITY;
      EXECUTE format('CREATE POLICY automation_suites_owner_access ON public.automation_suites FOR ALL TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L) WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)', _owner_col, 'admin', _owner_col, 'admin');
    END IF;
  END IF;

  -- automation_scripts
  IF to_regclass('public.automation_scripts') IS NOT NULL THEN
    SELECT column_name INTO _owner_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_scripts'
      AND column_name IN ('owner_id', 'created_by', 'user_id')
    ORDER BY CASE column_name WHEN 'owner_id' THEN 1 WHEN 'created_by' THEN 2 WHEN 'user_id' THEN 3 ELSE 4 END
    LIMIT 1;

    IF _owner_col IS NOT NULL THEN
      ALTER TABLE public.automation_scripts ENABLE ROW LEVEL SECURITY;
      EXECUTE format('CREATE POLICY automation_scripts_owner_access ON public.automation_scripts FOR ALL TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L) WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)', _owner_col, 'admin', _owner_col, 'admin');
    END IF;
  END IF;

  -- automation_executions
  IF to_regclass('public.automation_executions') IS NOT NULL THEN
    SELECT column_name INTO _owner_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_executions'
      AND column_name IN ('owner_id', 'created_by', 'user_id')
    ORDER BY CASE column_name WHEN 'owner_id' THEN 1 WHEN 'created_by' THEN 2 WHEN 'user_id' THEN 3 ELSE 4 END
    LIMIT 1;

    IF _owner_col IS NOT NULL THEN
      ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
      EXECUTE format('CREATE POLICY automation_executions_owner_access ON public.automation_executions FOR ALL TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L) WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)', _owner_col, 'admin', _owner_col, 'admin');
    END IF;
  END IF;

  -- automation_execution_results
  IF to_regclass('public.automation_execution_results') IS NOT NULL THEN
    SELECT column_name INTO _owner_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_execution_results'
      AND column_name IN ('owner_id', 'created_by', 'user_id')
    ORDER BY CASE column_name WHEN 'owner_id' THEN 1 WHEN 'created_by' THEN 2 WHEN 'user_id' THEN 3 ELSE 4 END
    LIMIT 1;

    IF _owner_col IS NOT NULL THEN
      ALTER TABLE public.automation_execution_results ENABLE ROW LEVEL SECURITY;
      EXECUTE format('CREATE POLICY automation_execution_results_owner_access ON public.automation_execution_results FOR ALL TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L) WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)', _owner_col, 'admin', _owner_col, 'admin');
    END IF;
  END IF;

  -- automation_runs
  IF to_regclass('public.automation_runs') IS NOT NULL THEN
    SELECT column_name INTO _owner_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_runs'
      AND column_name IN ('created_by', 'owner_id', 'user_id')
    ORDER BY CASE column_name WHEN 'created_by' THEN 1 WHEN 'owner_id' THEN 2 WHEN 'user_id' THEN 3 ELSE 4 END
    LIMIT 1;

    IF _owner_col IS NOT NULL THEN
      ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
      EXECUTE format('CREATE POLICY automation_runs_owner_access ON public.automation_runs FOR ALL TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L) WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)', _owner_col, 'admin', _owner_col, 'admin');
    END IF;
  END IF;

  -- automation_results: child rows must be owned by the parent run owner.
  IF to_regclass('public.automation_results') IS NOT NULL AND to_regclass('public.automation_runs') IS NOT NULL THEN
    SELECT column_name INTO _owner_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_runs'
      AND column_name IN ('created_by', 'owner_id', 'user_id')
    ORDER BY CASE column_name WHEN 'created_by' THEN 1 WHEN 'owner_id' THEN 2 WHEN 'user_id' THEN 3 ELSE 4 END
    LIMIT 1;

    IF _owner_col IS NOT NULL THEN
      ALTER TABLE public.automation_results ENABLE ROW LEVEL SECURITY;
      EXECUTE format(
        'CREATE POLICY automation_results_run_owner_access ON public.automation_results FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.automation_runs r WHERE r.id = public.automation_results.run_id AND (r.%I = auth.uid() OR public.get_current_user_role() = %L))) WITH CHECK (EXISTS (SELECT 1 FROM public.automation_runs r WHERE r.id = public.automation_results.run_id AND (r.%I = auth.uid() OR public.get_current_user_role() = %L)))',
        _owner_col,
        'admin',
        _owner_col,
        'admin'
      );
    END IF;
  END IF;
END $$;

COMMIT;
