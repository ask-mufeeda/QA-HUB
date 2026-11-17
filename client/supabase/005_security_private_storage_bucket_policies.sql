-- Template storage policy migration for private bug attachment files.
-- This script is intentionally written as a safe template because bucket names and storage policies
-- in the live Supabase project must be confirmed before execution.
-- Do not run this in production until the actual bucket configuration is reviewed and validated.

BEGIN;

-- Example policy set for a private bug-attachments bucket.
-- Replace bucket name and ownership conditions to match the live storage configuration.

-- SELECT POLICY: owner or admin can read the file.
-- DROP POLICY IF EXISTS bug_attachments_select_own ON storage.objects;
-- CREATE POLICY bug_attachments_select_own
-- ON storage.objects
-- FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'bug-attachments'
--   AND (owner = auth.uid() OR public.get_current_user_role() = 'admin')
-- );

-- INSERT POLICY: only the file owner can upload.
-- DROP POLICY IF EXISTS bug_attachments_insert_own ON storage.objects;
-- CREATE POLICY bug_attachments_insert_own
-- ON storage.objects
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'bug-attachments'
--   AND owner = auth.uid()
-- );

-- UPDATE POLICY: owner or admin only.
-- DROP POLICY IF EXISTS bug_attachments_update_own ON storage.objects;
-- CREATE POLICY bug_attachments_update_own
-- ON storage.objects
-- FOR UPDATE
-- TO authenticated
-- USING (
--   bucket_id = 'bug-attachments'
--   AND (owner = auth.uid() OR public.get_current_user_role() = 'admin')
-- )
-- WITH CHECK (
--   bucket_id = 'bug-attachments'
--   AND (owner = auth.uid() OR public.get_current_user_role() = 'admin')
-- );

-- DELETE POLICY: owner or admin only.
-- DROP POLICY IF EXISTS bug_attachments_delete_own ON storage.objects;
-- CREATE POLICY bug_attachments_delete_own
-- ON storage.objects
-- FOR DELETE
-- TO authenticated
-- USING (
--   bucket_id = 'bug-attachments'
--   AND (owner = auth.uid() OR public.get_current_user_role() = 'admin')
-- );

COMMIT;
