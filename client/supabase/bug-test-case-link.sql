-- Add a nullable link from a bug back to the failed test case that created it.
ALTER TABLE public.bugs
  ADD COLUMN IF NOT EXISTS test_case_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bugs_test_case_id_fkey'
  ) THEN
    ALTER TABLE public.bugs
      ADD CONSTRAINT bugs_test_case_id_fkey
      FOREIGN KEY (test_case_id)
      REFERENCES public.test_cases (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bugs_test_case_id_idx
  ON public.bugs (test_case_id);
