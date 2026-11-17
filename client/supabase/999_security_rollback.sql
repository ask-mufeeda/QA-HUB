-- Rollback script for the security migration set.
-- This file is for staging or recovery use only.
-- It does not run automatically and should be reviewed in the live environment before execution.

BEGIN;

-- Disable RLS only as a temporary emergency recovery action.
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bugs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_cases DISABLE ROW LEVEL SECURITY;

-- Drop role helper.
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Drop profile policies.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_non_role ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_full_access ON public.profiles;

-- Drop test_cases policies.
DROP POLICY IF EXISTS test_cases_select_own ON public.test_cases;
DROP POLICY IF EXISTS test_cases_insert_own ON public.test_cases;
DROP POLICY IF EXISTS test_cases_update_own ON public.test_cases;
DROP POLICY IF EXISTS test_cases_delete_own ON public.test_cases;

-- Drop bug policies.
DROP POLICY IF EXISTS bugs_select_own_or_assigned ON public.bugs;
DROP POLICY IF EXISTS bugs_insert_own ON public.bugs;
DROP POLICY IF EXISTS bugs_update_own_or_assigned ON public.bugs;
DROP POLICY IF EXISTS bugs_delete_own_or_admin ON public.bugs;

-- Optional schema rollback for the additive security fields.
-- Only use this if a verified backup exists and the fields are confirmed unnecessary.
ALTER TABLE IF EXISTS public.bugs
  DROP CONSTRAINT IF EXISTS bugs_created_by_fkey;

ALTER TABLE IF EXISTS public.bugs
  DROP CONSTRAINT IF EXISTS bugs_assigned_to_fkey;

ALTER TABLE IF EXISTS public.test_cases
  DROP CONSTRAINT IF EXISTS test_cases_created_by_fkey;

ALTER TABLE IF EXISTS public.bugs
  DROP COLUMN IF EXISTS created_by;

ALTER TABLE IF EXISTS public.bugs
  DROP COLUMN IF EXISTS assigned_to;

ALTER TABLE IF EXISTS public.bugs
  DROP COLUMN IF EXISTS created_at;

ALTER TABLE IF EXISTS public.bugs
  DROP COLUMN IF EXISTS updated_at;

ALTER TABLE IF EXISTS public.test_cases
  DROP COLUMN IF EXISTS created_by;

ALTER TABLE IF EXISTS public.test_cases
  DROP COLUMN IF EXISTS updated_at;

COMMIT;
