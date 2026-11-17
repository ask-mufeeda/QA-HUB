-- Safe additive migration for bug ownership and assignment.
-- This script intentionally does not overwrite existing data.
-- It adds missing ownership/assignment columns only when they are not present and backfills
-- them only when a safe, verified profile match exists.

BEGIN;

-- 1) Add missing columns without changing current records.
ALTER TABLE IF EXISTS public.bugs
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE IF EXISTS public.bugs
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

ALTER TABLE IF EXISTS public.bugs
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE IF EXISTS public.bugs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 2) Backfill timestamps conservatively.
UPDATE public.bugs
SET created_at = COALESCE(created_at, reported_at, now())
WHERE created_at IS NULL;

UPDATE public.bugs
SET updated_at = COALESCE(updated_at, reported_at, created_at, now())
WHERE updated_at IS NULL;

-- 3) Backfill created_by only when a profile email matches the existing tester_email field.
UPDATE public.bugs b
SET created_by = p.id
FROM public.profiles p
WHERE b.created_by IS NULL
  AND p.email IS NOT NULL
  AND b.tester_email IS NOT NULL
  AND lower(trim(b.tester_email)) = lower(trim(p.email));

-- 4) Backfill assigned_to only when a profile email matches the existing developer_email field.
UPDATE public.bugs b
SET assigned_to = p.id
FROM public.profiles p
WHERE b.assigned_to IS NULL
  AND p.email IS NOT NULL
  AND b.developer_email IS NOT NULL
  AND lower(trim(b.developer_email)) = lower(trim(p.email));

-- 5) Add foreign keys only if missing.
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

-- 6) Add simple indexes for ownership and assignment lookups.
CREATE INDEX IF NOT EXISTS bugs_created_by_idx
  ON public.bugs (created_by);

CREATE INDEX IF NOT EXISTS bugs_assigned_to_idx
  ON public.bugs (assigned_to);

CREATE INDEX IF NOT EXISTS bugs_status_idx
  ON public.bugs (status);

COMMIT;
