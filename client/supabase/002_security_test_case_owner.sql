-- Safe additive migration for test_cases ownership.
-- This script adds a creator reference when it does not already exist and keeps data intact.
-- It does not force ownership onto records that cannot be mapped confidently.

BEGIN;

ALTER TABLE IF EXISTS public.test_cases
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE IF EXISTS public.test_cases
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.test_cases
SET updated_at = COALESCE(updated_at, now())
WHERE updated_at IS NULL;

-- If a live schema already stores tester ownership in tester_id, prefer it as a best-effort mapping.
-- This only fills created_by when it is blank and tester_id is present.
UPDATE public.test_cases tc
SET created_by = tc.tester_id
WHERE tc.created_by IS NULL
  AND tc.tester_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'test_cases_created_by_fkey'
  ) THEN
    ALTER TABLE public.test_cases
      ADD CONSTRAINT test_cases_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS test_cases_created_by_idx
  ON public.test_cases (created_by);

CREATE INDEX IF NOT EXISTS test_cases_status_idx
  ON public.test_cases (status);

COMMIT;
