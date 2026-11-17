-- Migration 005: Restrict learning progress access and delete operations to the owner/admin.
-- Problem:
--   If permissive policies exist on learning or SQL-practice records, one user could read or delete another person’s progress.
-- Safety:
--   This migration removes all policies on the target tables and recreates them with owner-scoped checks.

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
  _user_col text;
  _policy record;
BEGIN
  FOR _table_name IN 'learning_progress', 'sql_practice_progress'
  LOOP
    IF to_regclass('public.' || _table_name) IS NULL THEN
      RAISE NOTICE 'Skipping learning table %: table does not exist.', _table_name;
      CONTINUE;
    END IF;

    FOR _policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = _table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _policy.policyname, _table_name);
    END LOOP;

    SELECT column_name INTO _user_col
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = _table_name
      AND column_name IN ('user_id', 'owner_id', 'created_by')
    ORDER BY CASE column_name
      WHEN 'user_id' THEN 1
      WHEN 'owner_id' THEN 2
      WHEN 'created_by' THEN 3
      ELSE 4
    END
    LIMIT 1;

    IF _user_col IS NULL THEN
      RAISE NOTICE 'Skipping learning table %: no supported ownership column found.', _table_name;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', _table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L)',
      _table_name || '_select_own',
      _table_name,
      _user_col,
      'admin'
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)',
      _table_name || '_insert_own',
      _table_name,
      _user_col,
      'admin'
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L) WITH CHECK (%I = auth.uid() OR public.get_current_user_role() = %L)',
      _table_name || '_update_own',
      _table_name,
      _user_col,
      'admin',
      _user_col,
      'admin'
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%I = auth.uid() OR public.get_current_user_role() = %L)',
      _table_name || '_delete_own',
      _table_name,
      _user_col,
      'admin'
    );
  END LOOP;
END $$;

COMMIT;
