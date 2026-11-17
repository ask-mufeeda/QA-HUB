CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.requirements_generate_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_number integer;
BEGIN
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    SELECT COALESCE(MAX(CAST(substring(code FROM 'REQ-(\d+)$') AS integer)), 0) + 1
    INTO next_number
    FROM public.requirements
    WHERE code ~ '^REQ-[0-9]+$';

    NEW.code = 'REQ-' || lpad(next_number::text, 3, '0');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  title text NOT NULL CHECK (char_length(btrim(title)) > 0),
  description text NOT NULL DEFAULT '',
  priority text NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
  status text NOT NULL CHECK (status IN ('Draft', 'Approved', 'Implemented')),
  test_plan_id uuid REFERENCES public.test_plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.requirement_test_case_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_id, test_case_id)
);

CREATE INDEX IF NOT EXISTS requirements_created_by_idx
  ON public.requirements (created_by, updated_at DESC);

CREATE INDEX IF NOT EXISTS requirements_plan_idx
  ON public.requirements (test_plan_id, created_by);

CREATE INDEX IF NOT EXISTS requirement_test_case_links_requirement_idx
  ON public.requirement_test_case_links (requirement_id, test_case_id);

CREATE INDEX IF NOT EXISTS requirement_test_case_links_case_idx
  ON public.requirement_test_case_links (test_case_id, requirement_id);

CREATE TRIGGER requirements_generate_code_trigger
BEFORE INSERT OR UPDATE OF code ON public.requirements
FOR EACH ROW
WHEN (NEW.code IS NULL OR btrim(NEW.code) = '')
EXECUTE FUNCTION public.requirements_generate_code();

CREATE TRIGGER requirements_set_updated_at
BEFORE UPDATE ON public.requirements
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_test_case_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS requirements_select_own ON public.requirements;
DROP POLICY IF EXISTS requirements_insert_own ON public.requirements;
DROP POLICY IF EXISTS requirements_update_own ON public.requirements;
DROP POLICY IF EXISTS requirements_delete_own ON public.requirements;

DROP POLICY IF EXISTS requirement_test_case_links_select_own ON public.requirement_test_case_links;
DROP POLICY IF EXISTS requirement_test_case_links_insert_own ON public.requirement_test_case_links;
DROP POLICY IF EXISTS requirement_test_case_links_delete_own ON public.requirement_test_case_links;

CREATE POLICY requirements_select_own
  ON public.requirements
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY requirements_insert_own
  ON public.requirements
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY requirements_update_own
  ON public.requirements
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (
    created_by = auth.uid()
    AND (test_plan_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.test_plans tp
      WHERE tp.id = test_plan_id
        AND tp.owner_id = auth.uid()
    ))
  );

CREATE POLICY requirements_delete_own
  ON public.requirements
  FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY requirement_test_case_links_select_own
  ON public.requirement_test_case_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.requirements r
      WHERE r.id = requirement_id
        AND r.created_by = auth.uid()
    )
  );

CREATE POLICY requirement_test_case_links_insert_own
  ON public.requirement_test_case_links
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.requirements r
      WHERE r.id = requirement_id
        AND r.created_by = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.test_cases tc
      WHERE tc.id = test_case_id
        AND tc.created_by = auth.uid()
    )
  );

CREATE POLICY requirement_test_case_links_delete_own
  ON public.requirement_test_case_links
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.requirements r
      WHERE r.id = requirement_id
        AND r.created_by = auth.uid()
    )
  );
