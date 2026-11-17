create table if not exists public.sql_practice_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  attempt_count integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.sql_practice_progress enable row level security;

grant select, insert, update on public.sql_practice_progress to authenticated;

drop policy if exists sql_practice_progress_select_own on public.sql_practice_progress;
create policy sql_practice_progress_select_own
  on public.sql_practice_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists sql_practice_progress_insert_own on public.sql_practice_progress;
create policy sql_practice_progress_insert_own
  on public.sql_practice_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists sql_practice_progress_update_own on public.sql_practice_progress;
create policy sql_practice_progress_update_own
  on public.sql_practice_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
