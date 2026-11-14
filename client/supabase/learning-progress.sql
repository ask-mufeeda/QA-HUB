create table if not exists public.learning_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.learning_progress enable row level security;

grant select, insert, update on public.learning_progress to authenticated;

drop policy if exists learning_progress_select_own on public.learning_progress;
create policy learning_progress_select_own
  on public.learning_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists learning_progress_insert_own on public.learning_progress;
create policy learning_progress_insert_own
  on public.learning_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists learning_progress_update_own on public.learning_progress;
create policy learning_progress_update_own
  on public.learning_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
