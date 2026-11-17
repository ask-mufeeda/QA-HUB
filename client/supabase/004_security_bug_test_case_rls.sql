-- RLS for test_cases and bugs.
-- This keeps access tied to recorded ownership and admin status without changing existing data.
-- The app should continue to use created_by / assigned_to, while developer_email and tester_email
-- remain display-only compatibility values and are not used as a security check.

BEGIN;

ALTER TABLE IF EXISTS public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bugs ENABLE ROW LEVEL SECURITY;

-- test_cases: any user can see or edit only their own rows, unless admin.
DROP POLICY IF EXISTS test_cases_select_own ON public.test_cases;
CREATE POLICY test_cases_select_own
ON public.test_cases
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS test_cases_insert_own ON public.test_cases;
CREATE POLICY test_cases_insert_own
ON public.test_cases
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS test_cases_update_own ON public.test_cases;
CREATE POLICY test_cases_update_own
ON public.test_cases
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.get_current_user_role() = 'admin'
)
WITH CHECK (
  created_by = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS test_cases_delete_own ON public.test_cases;
CREATE POLICY test_cases_delete_own
ON public.test_cases
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

-- bugs: creator, assignee, or admin can see/update; users cannot change role because role is not in this table.
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

DROP POLICY IF EXISTS bugs_insert_own ON public.bugs;
CREATE POLICY bugs_insert_own
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
  OR assigned_to = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS bugs_delete_own_or_admin ON public.bugs;
CREATE POLICY bugs_delete_own_or_admin
ON public.bugs
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.get_current_user_role() = 'admin'
);

COMMIT;
