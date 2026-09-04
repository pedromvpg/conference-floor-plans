create table if not exists public.draft_versions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by text not null default ''
);

create index if not exists draft_versions_event_created_idx
  on public.draft_versions (event_id, created_at desc);

alter table public.draft_versions enable row level security;

create policy "editors manage draft versions"
  on public.draft_versions for all
  using (
    exists (
      select 1 from public.allowed_editors e
      where e.email = lower(auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from public.allowed_editors e
      where e.email = lower(auth.jwt() ->> 'email')
    )
  );
