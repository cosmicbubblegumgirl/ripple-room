-- Ripple Room private cloud copies. Apply once to a Supabase Postgres project.
create table public.rr_workspaces (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create index rr_workspaces_user_updated_idx on public.rr_workspaces(user_id, updated_at desc);
alter table public.rr_workspaces enable row level security;
revoke all on public.rr_workspaces from anon, authenticated;
grant select, insert, update, delete on public.rr_workspaces to authenticated;
create policy rr_owner_select on public.rr_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy rr_owner_insert on public.rr_workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy rr_owner_update on public.rr_workspaces for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy rr_owner_delete on public.rr_workspaces for delete to authenticated
  using ((select auth.uid()) = user_id);
alter table public.rr_workspaces
  add constraint rr_workspace_data_size check (octet_length(data::text) <= 2097152),
  add constraint rr_workspace_positive_version check (version >= 1);
