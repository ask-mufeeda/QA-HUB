-- Bug tracker ownership and role hardening.
-- This migration is intentionally additive and does not execute here.
-- Review the live schema before applying it to a production database.

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

ALTER TABLE IF EXISTS public.bugs
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE IF EXISTS public.bugs
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

ALTER TABLE IF EXISTS public.bugs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.bugs
SET created_at = COALESCE(created_at, reported_at, now())
WHERE created_at IS NULL;

UPDATE public.bugs
SET updated_at = COALESCE(updated_at, reported_at, created_at, now())
WHERE updated_at IS NULL;

UPDATE public.bugs b
SET created_by = p.id
FROM public.profiles p
WHERE b.created_by IS NULL
  AND p.email IS NOT NULL
  AND b.tester_email IS NOT NULL
  AND lower(trim(b.tester_email)) = lower(trim(p.email));

UPDATE public.bugs b
SET assigned_to = p.id
FROM public.profiles p
WHERE b.assigned_to IS NULL
  AND p.email IS NOT NULL
  AND b.developer_email IS NOT NULL
  AND lower(trim(b.developer_email)) = lower(trim(p.email));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bugs_created_by_fkey'
  ) THEN
    ALTER TABLE public.bugs
      ADD CONSTRAINT bugs_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bugs_assigned_to_fkey'
  ) THEN
    ALTER TABLE public.bugs
      ADD CONSTRAINT bugs_assigned_to_fkey
      FOREIGN KEY (assigned_to)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bugs_created_by_idx
  ON public.bugs (created_by);

CREATE INDEX IF NOT EXISTS bugs_assigned_to_idx
  ON public.bugs (assigned_to);

CREATE INDEX IF NOT EXISTS bugs_status_idx
  ON public.bugs (status);

CREATE OR REPLACE FUNCTION public.prevent_bug_ownership_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, auth
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Bug creator cannot be changed.';
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND public.get_current_user_role() <> 'admin'
     AND auth.uid() IS DISTINCT FROM OLD.assigned_to THEN
    RAISE EXCEPTION 'Only admins can reassign bugs.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bugs_prevent_ownership_changes ON public.bugs;
CREATE TRIGGER bugs_prevent_ownership_changes
BEFORE UPDATE ON public.bugs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bug_ownership_changes();

ALTER TABLE IF EXISTS public.bugs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bugs_select_own_or_assigned ON public.bugs;
CREATE POLICY bugs_select_own_or_assigned
ON public.bugs
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS bugs_insert_reporter ON public.bugs;
CREATE POLICY bugs_insert_reporter
ON public.bugs
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS bugs_update_own_or_assigned ON public.bugs;
CREATE POLICY bugs_update_own_or_assigned
ON public.bugs
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR public.get_current_user_role() = 'admin'
)
WITH CHECK (
  created_by = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS bugs_delete_admin_only ON public.bugs;
CREATE POLICY bugs_delete_admin_only
ON public.bugs
FOR DELETE
TO authenticated
USING (
  public.get_current_user_role() = 'admin'
);

COMMIT;
