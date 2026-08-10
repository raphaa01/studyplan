create table public.study_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint study_data_data_is_object check (jsonb_typeof(data) = 'object')
);

alter table public.study_data enable row level security;
alter table public.study_data force row level security;

revoke all on table public.study_data from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.study_data to authenticated;

create policy "Users can read their own study data"
on public.study_data
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own study data"
on public.study_data
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own study data"
on public.study_data
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own study data"
on public.study_data
for delete
to authenticated
using ((select auth.uid()) = user_id);
