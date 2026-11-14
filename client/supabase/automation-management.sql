create table if not exists public.automation_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.automation_suites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (project_id, owner_id)
    references public.automation_projects (id, owner_id)
    deferrable initially deferred
);

create table if not exists public.automation_scripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  suite_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  source_code text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (suite_id, owner_id)
    references public.automation_suites (id, owner_id)
    deferrable initially deferred
);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null,
  suite_id uuid,
  script_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'passed', 'failed', 'cancelled')),
  total_tests integer not null default 0 check (total_tests >= 0),
  passed_count integer not null default 0 check (passed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  check (total_tests = passed_count + failed_count + skipped_count),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check ((script_id is null) <> (suite_id is null)),
  foreign key (project_id, owner_id)
    references public.automation_projects (id, owner_id)
    deferrable initially deferred,
  foreign key (suite_id, owner_id)
    references public.automation_suites (id, owner_id)
    deferrable initially deferred,
  foreign key (script_id, owner_id)
    references public.automation_scripts (id, owner_id)
    deferrable initially deferred
);

create table if not exists public.automation_execution_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  execution_id uuid not null,
  script_id uuid not null,
  test_name text not null check (char_length(btrim(test_name)) between 1 and 160),
  status text not null check (status in ('passed', 'failed', 'skipped')),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  expected_result text,
  actual_result text,
  error_message text,
  screenshot_path text,
  created_at timestamptz not null default now(),
  foreign key (execution_id, owner_id)
    references public.automation_executions (id, owner_id)
    deferrable initially deferred,
  foreign key (script_id, owner_id)
    references public.automation_scripts (id, owner_id)
    deferrable initially deferred
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  run_name text not null check (char_length(btrim(run_name)) between 1 and 160),
  status text not null default 'running'
    check (status in ('running', 'passed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total integer not null default 0 check (total >= 0),
  passed integer not null default 0 check (passed >= 0),
  failed integer not null default 0 check (failed >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  source text not null default 'local' check (source in ('local', 'ci')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (total = passed + failed + skipped),
  unique (id, created_by)
);

create table if not exists public.automation_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs (id) on delete cascade,
  test_name text not null check (char_length(btrim(test_name)) between 1 and 160),
  file text,
  status text not null check (status in ('passed', 'failed', 'skipped')),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_message text,
  linked_test_case_id uuid references public.test_cases (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists automation_suites_owner_project_idx
  on public.automation_suites (owner_id, project_id);
create index if not exists automation_scripts_owner_suite_idx
  on public.automation_scripts (owner_id, suite_id);
create index if not exists automation_executions_owner_started_idx
  on public.automation_executions (owner_id, started_at desc);
create index if not exists automation_execution_results_owner_status_idx
  on public.automation_execution_results (owner_id, status);
create index if not exists automation_execution_results_execution_idx
  on public.automation_execution_results (owner_id, execution_id);
create index if not exists automation_execution_results_owner_script_idx
  on public.automation_execution_results (owner_id, script_id);
create index if not exists automation_runs_created_by_started_idx
  on public.automation_runs (created_by, started_at desc);
create index if not exists automation_results_run_id_created_idx
  on public.automation_results (run_id, created_at asc);

create or replace function public.set_automation_run_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  totals record;
  target_run_id uuid;
begin
  if TG_OP = 'DELETE' then
    target_run_id := old.run_id;
  elsif TG_OP = 'INSERT' or TG_OP = 'UPDATE' then
    target_run_id := new.run_id;
  else
    return coalesce(new, old);
  end if;

  select
    count(*) as total,
    count(*) filter (where status = 'passed') as passed,
    count(*) filter (where status = 'failed') as failed,
    count(*) filter (where status = 'skipped') as skipped
    into totals
  from public.automation_results
  where run_id = target_run_id;

  update public.automation_runs
  set
    total = coalesce(totals.total, 0),
    passed = coalesce(totals.passed, 0),
    failed = coalesce(totals.failed, 0),
    skipped = coalesce(totals.skipped, 0),
    status = case
      when exists (select 1 from public.automation_results where run_id = public.automation_runs.id and status = 'failed') then 'failed'
      when exists (select 1 from public.automation_results where run_id = public.automation_runs.id and status = 'passed') then 'passed'
      else 'running'
    end,
    finished_at = case
      when coalesce(totals.total, 0) > 0 then now()
      else public.automation_runs.finished_at
    end
  where id = target_run_id;

  return coalesce(new, old);
end;
$$;

do $$
begin
  drop trigger if exists automation_results_totals_trigger on public.automation_results;

  create trigger automation_results_totals_trigger
    after insert or update of status or delete
    on public.automation_results
    for each row
    execute function public.set_automation_run_totals();
end $$;

create or replace function public.seed_automation_runs()
returns void
language plpgsql
set search_path = ''
as $$
declare
  demo_user uuid;
  demo_case uuid;
  demo_run uuid;
begin
  select id into demo_user from auth.users order by created_at limit 1;
  if demo_user is null then
    return;
  end if;

  if to_regclass('public.test_cases') is not null then
    select id into demo_case from public.test_cases order by created_at limit 1;
  end if;

  if not exists (
    select 1 from public.automation_runs where created_by = demo_user limit 1
  ) then
    insert into public.automation_runs (
      run_name,
      status,
      started_at,
      finished_at,
      source,
      created_by,
      total,
      passed,
      failed,
      skipped
    ) values (
      'Smoke suite',
      'passed',
      now() - interval '5 minutes',
      now(),
      'local',
      demo_user,
      3,
      2,
      0,
      1
    ) returning id into demo_run;

    insert into public.automation_results (run_id, test_name, file, status, duration_ms, error_message, linked_test_case_id)
    values
      (demo_run, 'shows the dashboard', 'tests/dashboard.spec.ts', 'passed', 1200, null, demo_case),
      (demo_run, 'updates the filters', 'tests/dashboard.spec.ts', 'failed', 2400, 'Filter did not reset after toggling', demo_case),
      (demo_run, 'handles a empty state', 'tests/dashboard.spec.ts', 'skipped', 400, null, null);

    update public.automation_runs
    set
      total = 3,
      passed = 1,
      failed = 1,
      skipped = 1,
      status = 'failed'
    where id = demo_run;
  end if;
end;
$$;

select public.seed_automation_runs();

create or replace function public.set_automation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function public.validate_automation_execution_target()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_project_id uuid;
begin
  if TG_OP = 'UPDATE'
    and (
      new.owner_id is distinct from old.owner_id
      or new.project_id is distinct from old.project_id
      or new.suite_id is distinct from old.suite_id
      or new.script_id is distinct from old.script_id
    )
    and exists (
      select 1
      from public.automation_execution_results
      where execution_id = old.id
        and owner_id = old.owner_id
    )
  then
    raise exception 'An execution target cannot change after results are recorded.'
      using errcode = '23514';
  end if;

  if (new.script_id is null) = (new.suite_id is null) then
    raise exception 'An execution must target exactly one script or suite.'
      using errcode = '23514';
  end if;

  if new.script_id is not null then
    select suites.project_id
      into target_project_id
      from public.automation_scripts as scripts
      join public.automation_suites as suites
        on suites.id = scripts.suite_id
       and suites.owner_id = scripts.owner_id
      where scripts.id = new.script_id
        and scripts.owner_id = new.owner_id;
  else
    select project_id
      into target_project_id
      from public.automation_suites
      where id = new.suite_id
        and owner_id = new.owner_id;
  end if;

  if target_project_id is null then
    raise exception 'The execution target must belong to the same owner.'
      using errcode = '23503';
  end if;

  if new.project_id is distinct from target_project_id then
    raise exception 'The execution project must match its script or suite.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_automation_execution_result()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  execution_script_id uuid;
  execution_suite_id uuid;
  result_suite_id uuid;
begin
  if TG_OP = 'UPDATE'
    and (
      new.owner_id is distinct from old.owner_id
      or new.execution_id is distinct from old.execution_id
      or new.script_id is distinct from old.script_id
    )
  then
    raise exception 'A result cannot be moved to a different owner, execution, or script.'
      using errcode = '23514';
  end if;

  select script_id, suite_id
    into execution_script_id, execution_suite_id
    from public.automation_executions
    where id = new.execution_id
      and owner_id = new.owner_id;

  if not found then
    raise exception 'The execution must belong to the same owner as its result.'
      using errcode = '23503';
  end if;

  if execution_script_id is not null then
    if new.script_id is distinct from execution_script_id then
      raise exception 'A script execution result must reference its executed script.'
        using errcode = '23514';
    end if;
  else
    select suite_id
      into result_suite_id
      from public.automation_scripts
      where id = new.script_id
        and owner_id = new.owner_id;

    if not found or result_suite_id is distinct from execution_suite_id then
      raise exception 'A suite execution result must reference a script in that suite.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.set_automation_execution_counts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select
    count(*)::integer,
    count(*) filter (where status = 'passed')::integer,
    count(*) filter (where status = 'failed')::integer,
    count(*) filter (where status = 'skipped')::integer
    into new.total_tests, new.passed_count, new.failed_count, new.skipped_count
    from public.automation_execution_results
    where execution_id = new.id
      and owner_id = new.owner_id;

  return new;
end;
$$;

create or replace function public.refresh_automation_execution_counts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_execution_id uuid;
  target_owner_id uuid;
begin
  if TG_OP = 'DELETE' then
    target_execution_id := old.execution_id;
    target_owner_id := old.owner_id;
  else
    target_execution_id := new.execution_id;
    target_owner_id := new.owner_id;
  end if;

  update public.automation_executions as executions
    set total_tests = result_counts.total_tests,
        passed_count = result_counts.passed_count,
        failed_count = result_counts.failed_count,
        skipped_count = result_counts.skipped_count
    from (
      select
        count(*)::integer as total_tests,
        count(*) filter (where status = 'passed')::integer as passed_count,
        count(*) filter (where status = 'failed')::integer as failed_count,
        count(*) filter (where status = 'skipped')::integer as skipped_count
      from public.automation_execution_results
      where execution_id = target_execution_id
        and owner_id = target_owner_id
    ) as result_counts
    where executions.id = target_execution_id
      and executions.owner_id = target_owner_id;

  return null;
end;
$$;

drop trigger if exists automation_projects_set_updated_at
  on public.automation_projects;
create trigger automation_projects_set_updated_at
  before update on public.automation_projects
  for each row execute function public.set_automation_updated_at();

drop trigger if exists automation_suites_set_updated_at
  on public.automation_suites;
create trigger automation_suites_set_updated_at
  before update on public.automation_suites
  for each row execute function public.set_automation_updated_at();

drop trigger if exists automation_scripts_set_updated_at
  on public.automation_scripts;
create trigger automation_scripts_set_updated_at
  before update on public.automation_scripts
  for each row execute function public.set_automation_updated_at();

drop trigger if exists automation_executions_set_updated_at
  on public.automation_executions;
create trigger automation_executions_set_updated_at
  before update on public.automation_executions
  for each row execute function public.set_automation_updated_at();

drop trigger if exists automation_executions_validate_target
  on public.automation_executions;
create trigger automation_executions_validate_target
  before insert or update on public.automation_executions
  for each row execute function public.validate_automation_execution_target();

drop trigger if exists automation_executions_set_counts
  on public.automation_executions;
create trigger automation_executions_set_counts
  before insert or update on public.automation_executions
  for each row execute function public.set_automation_execution_counts();

drop trigger if exists automation_execution_results_validate
  on public.automation_execution_results;
create trigger automation_execution_results_validate
  before insert or update on public.automation_execution_results
  for each row execute function public.validate_automation_execution_result();

drop trigger if exists automation_execution_results_refresh_counts
  on public.automation_execution_results;
create trigger automation_execution_results_refresh_counts
  after insert or update or delete on public.automation_execution_results
  for each row execute function public.refresh_automation_execution_counts();

grant select, insert, update, delete on
  public.automation_projects,
  public.automation_suites,
  public.automation_scripts,
  public.automation_executions,
  public.automation_execution_results
to authenticated;

alter table public.automation_projects enable row level security;
alter table public.automation_suites enable row level security;
alter table public.automation_scripts enable row level security;
alter table public.automation_executions enable row level security;
alter table public.automation_execution_results enable row level security;

drop policy if exists automation_projects_owner_all on public.automation_projects;
create policy automation_projects_owner_all
  on public.automation_projects
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists automation_suites_owner_all on public.automation_suites;
create policy automation_suites_owner_all
  on public.automation_suites
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists automation_scripts_owner_all on public.automation_scripts;
create policy automation_scripts_owner_all
  on public.automation_scripts
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists automation_executions_owner_all on public.automation_executions;
create policy automation_executions_owner_all
  on public.automation_executions
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists automation_execution_results_owner_all
  on public.automation_execution_results;
create policy automation_execution_results_owner_all
  on public.automation_execution_results
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

notify pgrst, 'reload schema';
