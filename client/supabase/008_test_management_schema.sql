-- Test Management schema
-- This file is intentionally documented and ready for review.
-- It is not executed by this project and must only be applied after a live schema audit.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT public.current_user_role() = 'admin';
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

CREATE TABLE IF NOT EXISTS public.test_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  project text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.test_plan_assigned_testers (
  plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  tester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, tester_id)
);

CREATE TABLE IF NOT EXISTS public.test_plan_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  module text NOT NULL DEFAULT 'General',
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_case_scenario_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.test_plan_scenarios(id) ON DELETE CASCADE,
  test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, test_case_id)
);

CREATE TABLE IF NOT EXISTS public.test_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE RESTRICT,
  scenario_id uuid REFERENCES public.test_plan_scenarios(id) ON DELETE SET NULL,
  test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('Pass', 'Fail', 'Blocked', 'Not Run')),
  actual_result text NOT NULL DEFAULT '',
  comments text NOT NULL DEFAULT '',
  execution_date timestamptz NOT NULL DEFAULT now(),
  related_bug_id bigint REFERENCES public.bugs(id) ON DELETE SET NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_execution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.test_executions(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('Pass', 'Fail', 'Blocked', 'Not Run')),
  actual_result text NOT NULL DEFAULT '',
  comments text NOT NULL DEFAULT '',
  execution_date timestamptz NOT NULL DEFAULT now(),
  tester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_plans_owner_idx
  ON public.test_plans (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS test_plan_assigned_testers_plan_idx
  ON public.test_plan_assigned_testers (plan_id, tester_id);

CREATE INDEX IF NOT EXISTS test_plan_assigned_testers_tester_idx
  ON public.test_plan_assigned_testers (tester_id, plan_id);

CREATE INDEX IF NOT EXISTS test_plan_scenarios_plan_idx
  ON public.test_plan_scenarios (plan_id, owner_id);

CREATE INDEX IF NOT EXISTS test_case_scenario_links_scenario_idx
  ON public.test_case_scenario_links (scenario_id, test_case_id);

CREATE INDEX IF NOT EXISTS test_executions_plan_status_idx
  ON public.test_executions (plan_id, status);

CREATE INDEX IF NOT EXISTS test_executions_case_idx
  ON public.test_executions (test_case_id, execution_date DESC);

CREATE INDEX IF NOT EXISTS test_execution_history_execution_idx
  ON public.test_execution_history (execution_id, execution_date DESC);

CREATE OR REPLACE FUNCTION public.enforce_test_plan_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'test_plans.owner_id is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_test_plan_scenario_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    RAISE EXCEPTION 'test_plan_scenarios.plan_id is immutable';
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'test_plan_scenarios.owner_id is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_test_case_link_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.scenario_id IS DISTINCT FROM OLD.scenario_id THEN
    RAISE EXCEPTION 'test_case_scenario_links.scenario_id is immutable';
  END IF;

  IF NEW.test_case_id IS DISTINCT FROM OLD.test_case_id THEN
    RAISE EXCEPTION 'test_case_scenario_links.test_case_id is immutable';
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'test_case_scenario_links.owner_id is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_test_execution_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'test_executions.owner_id is immutable';
    END IF;

    IF NEW.tester_id IS DISTINCT FROM OLD.tester_id THEN
      RAISE EXCEPTION 'test_executions.tester_id is immutable';
    END IF;

    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
      RAISE EXCEPTION 'test_executions.plan_id is immutable';
    END IF;

    IF NEW.test_case_id IS DISTINCT FROM OLD.test_case_id THEN
      RAISE EXCEPTION 'test_executions.test_case_id is immutable';
    END IF;

    IF NEW.scenario_id IS DISTINCT FROM OLD.scenario_id THEN
      RAISE EXCEPTION 'test_executions.scenario_id is immutable';
    END IF;
  END IF;

  IF NEW.plan_id IS NULL THEN
    RAISE EXCEPTION 'test_executions.plan_id is required';
  END IF;

  IF NEW.test_case_id IS NULL THEN
    RAISE EXCEPTION 'test_executions.test_case_id is required';
  END IF;

  IF NEW.tester_id IS NULL THEN
    RAISE EXCEPTION 'test_executions.tester_id is required';
  END IF;

  IF NEW.scenario_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.test_plan_scenarios s
      WHERE s.id = NEW.scenario_id
        AND s.plan_id = NEW.plan_id
    ) THEN
      RAISE EXCEPTION 'scenario_id must belong to the execution plan';
    END IF;
  END IF;

  IF NOT public.is_admin_user() THEN
    IF NEW.owner_id <> auth.uid() THEN
      RAISE EXCEPTION 'Only the owner or an admin may create executions';
    END IF;

    IF NEW.tester_id <> auth.uid() THEN
      RAISE EXCEPTION 'Users may only assign executions to themselves';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.test_plans p
    WHERE p.id = NEW.plan_id
      AND (
        p.owner_id = auth.uid()
        OR public.is_admin_user()
        OR EXISTS (
          SELECT 1
          FROM public.test_plan_assigned_testers a
          WHERE a.plan_id = p.id
            AND a.tester_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'User is not authorized for this plan';
  END IF;

  IF public.is_admin_user() THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.test_plan_assigned_testers a
      WHERE a.plan_id = NEW.plan_id
        AND a.tester_id = NEW.tester_id
    ) THEN
      RAISE EXCEPTION 'Admin assignment requires a valid plan member';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.test_plan_assigned_testers a
      WHERE a.plan_id = NEW.plan_id
        AND a.tester_id = NEW.tester_id
    ) THEN
      RAISE EXCEPTION 'Execution tester must be assigned to the plan';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.test_cases tc
    WHERE tc.id = NEW.test_case_id
      AND (
        tc.created_by = auth.uid()
        OR public.is_admin_user()
        OR EXISTS (
          SELECT 1
          FROM public.test_plan_assigned_testers a
          WHERE a.plan_id = NEW.plan_id
            AND a.tester_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'test_case is not accessible for this execution';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_plan_delete_with_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.test_executions e
    JOIN public.test_execution_history h ON h.execution_id = e.id
    WHERE e.plan_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete a plan while execution history exists';
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_execution_delete_with_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.test_execution_history h
    WHERE h.execution_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete an execution while history exists';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER test_plans_set_updated_at
BEFORE UPDATE ON public.test_plans
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER test_plans_enforce_immutability
BEFORE UPDATE ON public.test_plans
FOR EACH ROW
EXECUTE FUNCTION public.enforce_test_plan_immutability();

CREATE TRIGGER test_plan_scenarios_set_updated_at
BEFORE UPDATE ON public.test_plan_scenarios
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER test_plan_scenarios_enforce_immutability
BEFORE UPDATE ON public.test_plan_scenarios
FOR EACH ROW
EXECUTE FUNCTION public.enforce_test_plan_scenario_immutability();

CREATE TRIGGER test_case_scenario_links_enforce_immutability
BEFORE UPDATE ON public.test_case_scenario_links
FOR EACH ROW
EXECUTE FUNCTION public.enforce_test_case_link_immutability();

CREATE TRIGGER test_executions_set_updated_at
BEFORE UPDATE ON public.test_executions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER test_executions_enforce_immutability
BEFORE INSERT OR UPDATE ON public.test_executions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_test_execution_immutability();

CREATE TRIGGER test_plans_prevent_delete_with_history
BEFORE DELETE ON public.test_plans
FOR EACH ROW
EXECUTE FUNCTION public.prevent_plan_delete_with_history();

CREATE TRIGGER test_executions_prevent_delete_with_history
BEFORE DELETE ON public.test_executions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_execution_delete_with_history();

ALTER TABLE public.test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_plan_assigned_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_plan_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_case_scenario_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_execution_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS test_plans_select_own ON public.test_plans;
CREATE POLICY test_plans_select_own
ON public.test_plans
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin_user()
  OR EXISTS (
    SELECT 1
    FROM public.test_plan_assigned_testers a
    WHERE a.plan_id = test_plans.id
      AND a.tester_id = auth.uid()
  )
);

DROP POLICY IF EXISTS test_plans_insert_own ON public.test_plans;
CREATE POLICY test_plans_insert_own
ON public.test_plans
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
);

DROP POLICY IF EXISTS test_plans_update_own ON public.test_plans;
CREATE POLICY test_plans_update_own
ON public.test_plans
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin_user()
)
WITH CHECK (
  owner_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS test_plans_delete_own ON public.test_plans;
CREATE POLICY test_plans_delete_own
ON public.test_plans
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS test_plan_assigned_testers_select_own ON public.test_plan_assigned_testers;
CREATE POLICY test_plan_assigned_testers_select_own
ON public.test_plan_assigned_testers
FOR SELECT
TO authenticated
USING (
  tester_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.test_plans p
    WHERE p.id = plan_id
      AND (
        p.owner_id = auth.uid()
        OR public.is_admin_user()
      )
  )
);

DROP POLICY IF EXISTS test_plan_assigned_testers_insert_own ON public.test_plan_assigned_testers;
CREATE POLICY test_plan_assigned_testers_insert_own
ON public.test_plan_assigned_testers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.test_plans p
    WHERE p.id = plan_id
      AND (
        p.owner_id = auth.uid()
        OR public.is_admin_user()
      )
  )
  AND tester_id IS NOT NULL
);

DROP POLICY IF EXISTS test_plan_assigned_testers_delete_own ON public.test_plan_assigned_testers;
CREATE POLICY test_plan_assigned_testers_delete_own
ON public.test_plan_assigned_testers
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.test_plans p
    WHERE p.id = plan_id
      AND (
        p.owner_id = auth.uid()
        OR public.is_admin_user()
      )
  )
);

DROP POLICY IF EXISTS test_plan_scenarios_select_own ON public.test_plan_scenarios;
CREATE POLICY test_plan_scenarios_select_own
ON public.test_plan_scenarios
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin_user()
  OR EXISTS (
    SELECT 1
    FROM public.test_plan_assigned_testers a
    WHERE a.plan_id = test_plan_scenarios.plan_id
      AND a.tester_id = auth.uid()
  )
);

DROP POLICY IF EXISTS test_plan_scenarios_insert_own ON public.test_plan_scenarios;
CREATE POLICY test_plan_scenarios_insert_own
ON public.test_plan_scenarios
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.test_plans p
    WHERE p.id = plan_id
      AND (
        p.owner_id = auth.uid()
        OR public.is_admin_user()
        OR EXISTS (
          SELECT 1
          FROM public.test_plan_assigned_testers a
          WHERE a.plan_id = p.id
            AND a.tester_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS test_plan_scenarios_update_own ON public.test_plan_scenarios;
CREATE POLICY test_plan_scenarios_update_own
ON public.test_plan_scenarios
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin_user()
)
WITH CHECK (
  owner_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS test_plan_scenarios_delete_own ON public.test_plan_scenarios;
CREATE POLICY test_plan_scenarios_delete_own
ON public.test_plan_scenarios
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS test_case_scenario_links_select_own ON public.test_case_scenario_links;
CREATE POLICY test_case_scenario_links_select_own
ON public.test_case_scenario_links
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin_user()
  OR EXISTS (
    SELECT 1
    FROM public.test_plan_scenarios s
    JOIN public.test_plans p ON p.id = s.plan_id
    WHERE s.id = scenario_id
      AND (
        p.owner_id = auth.uid()
        OR public.is_admin_user()
        OR EXISTS (
          SELECT 1
          FROM public.test_plan_assigned_testers a
          WHERE a.plan_id = p.id
            AND a.tester_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS test_case_scenario_links_insert_own ON public.test_case_scenario_links;
CREATE POLICY test_case_scenario_links_insert_own
ON public.test_case_scenario_links
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.test_plan_scenarios s
    JOIN public.test_plans p ON p.id = s.plan_id
    WHERE s.id = scenario_id
      AND (
        p.owner_id = auth.uid()
        OR public.is_admin_user()
        OR EXISTS (
          SELECT 1
          FROM public.test_plan_assigned_testers a
          WHERE a.plan_id = p.id
            AND a.tester_id = auth.uid()
        )
      )
  )
  AND EXISTS (
    SELECT 1
    FROM public.test_cases tc
    WHERE tc.id = test_case_id
      AND (
        tc.created_by = auth.uid()
        OR public.is_admin_user()
      )
  )
);

DROP POLICY IF EXISTS test_case_scenario_links_delete_own ON public.test_case_scenario_links;
CREATE POLICY test_case_scenario_links_delete_own
ON public.test_case_scenario_links
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS test_executions_select_own ON public.test_executions;
CREATE POLICY test_executions_select_own
ON public.test_executions
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR tester_id = auth.uid()
  OR public.is_admin_user()
  OR EXISTS (
    SELECT 1
    FROM public.test_plan_assigned_testers a
    WHERE a.plan_id = test_executions.plan_id
      AND a.tester_id = auth.uid()
  )
);

DROP POLICY IF EXISTS test_executions_insert_own ON public.test_executions;
CREATE POLICY test_executions_insert_own
ON public.test_executions
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.is_admin_user()
    OR owner_id = auth.uid()
  )
  AND (
    public.is_admin_user()
    OR tester_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.test_plans p
    WHERE p.id = plan_id
      AND (
        p.owner_id = auth.uid()
        OR public.is_admin_user()
        OR EXISTS (
          SELECT 1
          FROM public.test_plan_assigned_testers a
          WHERE a.plan_id = p.id
            AND a.tester_id = auth.uid()
        )
      )
  )
  AND EXISTS (
    SELECT 1
    FROM public.test_plan_assigned_testers a
    WHERE a.plan_id = plan_id
      AND a.tester_id = tester_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.test_cases tc
    WHERE tc.id = test_case_id
      AND (
        tc.created_by = auth.uid()
        OR public.is_admin_user()
        OR EXISTS (
          SELECT 1
          FROM public.test_plan_assigned_testers a
          WHERE a.plan_id = plan_id
            AND a.tester_id = auth.uid()
        )
      )
  )
  AND (
    scenario_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.test_plan_scenarios s
      JOIN public.test_plans p ON p.id = s.plan_id
      WHERE s.id = scenario_id
        AND (
          p.owner_id = auth.uid()
          OR public.is_admin_user()
          OR EXISTS (
            SELECT 1
            FROM public.test_plan_assigned_testers a
            WHERE a.plan_id = p.id
              AND a.tester_id = auth.uid()
          )
        )
    )
  )
);

DROP POLICY IF EXISTS test_executions_update_own ON public.test_executions;
CREATE POLICY test_executions_update_own
ON public.test_executions
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR tester_id = auth.uid()
  OR public.is_admin_user()
)
WITH CHECK (
  owner_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS test_executions_delete_own ON public.test_executions;
CREATE POLICY test_executions_delete_own
ON public.test_executions
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS test_execution_history_select_own ON public.test_execution_history;
CREATE POLICY test_execution_history_select_own
ON public.test_execution_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.test_executions e
    WHERE e.id = execution_id
      AND (
        e.owner_id = auth.uid()
        OR e.tester_id = auth.uid()
        OR public.is_admin_user()
        OR EXISTS (
          SELECT 1
          FROM public.test_plan_assigned_testers a
          WHERE a.plan_id = e.plan_id
            AND a.tester_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS test_execution_history_insert_own ON public.test_execution_history;
CREATE POLICY test_execution_history_insert_own
ON public.test_execution_history
FOR INSERT
TO authenticated
WITH CHECK (
  tester_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.test_executions e
    WHERE e.id = execution_id
      AND (
        e.owner_id = auth.uid()
        OR e.tester_id = auth.uid()
        OR public.is_admin_user()
        OR EXISTS (
          SELECT 1
          FROM public.test_plan_assigned_testers a
          WHERE a.plan_id = e.plan_id
            AND a.tester_id = auth.uid()
        )
      )
  )
);

-- No UPDATE/DELETE policy for history rows.
-- History is intentionally append-only.
-- Deleting a plan or execution will fail instead of cascading into historical audit records.

COMMIT;
