-- Migration 006: Harden storage access without exposing bug attachments publicly.
-- Problem:
--   The app currently uses public URLs for bug attachments. If the bucket is public, private files can be accessed by anyone.
--   This migration does not convert an existing public bucket to a private bucket unless the frontend is ready for signed URLs.
-- Safety:
--   The bucket public flag is left unchanged. This prevents a silent breaking change while the frontend is prepared.

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
  _bucket_exists boolean;
  _bucket_is_public boolean;
  _policy record;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'bug-attachments'
  ) INTO _bucket_exists;

  IF NOT _bucket_exists THEN
    RAISE NOTICE 'Skipping storage hardening: storage bucket bug-attachments does not exist.';
    RETURN;
  END IF;

  SELECT public INTO _bucket_is_public
  FROM storage.buckets
  WHERE id = 'bug-attachments';

  IF _bucket_is_public THEN
    RAISE NOTICE 'Skipping storage policy creation: bug-attachments is still public. Update the frontend to use signed URLs before enforcing private access.';
    RETURN;
  END IF;

  FOR _policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'bug_attachments_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', _policy.policyname);
  END LOOP;

  CREATE POLICY bug_attachments_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bug-attachments'
    AND (owner = auth.uid() OR public.get_current_user_role() = 'admin')
  );

  CREATE POLICY bug_attachments_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bug-attachments'
    AND owner = auth.uid()
  );

  CREATE POLICY bug_attachments_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bug-attachments'
    AND (owner = auth.uid() OR public.get_current_user_role() = 'admin')
  )
  WITH CHECK (
    bucket_id = 'bug-attachments'
    AND (owner = auth.uid() OR public.get_current_user_role() = 'admin')
  );

  CREATE POLICY bug_attachments_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bug-attachments'
    AND (owner = auth.uid() OR public.get_current_user_role() = 'admin')
  );
END $$;

COMMIT;
