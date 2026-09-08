alter table public.events
  add column if not exists airtable_agenda_table text not null default '',
  add column if not exists airtable_speakers_table text not null default '',
  add column if not exists sponsors_synced_at timestamptz,
  add column if not exists agenda_synced_at timestamptz,
  add column if not exists speakers_synced_at timestamptz;

create table if not exists public.library_assets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (kind in ('texture', 'model')),
  name text not null default '',
  url text not null,
  content_type text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  airtable_id text not null,
  title text not null default '',
  stage text not null default '',
  start_unix double precision,
  end_unix double precision,
  speaker_ids jsonb not null default '[]'::jsonb,
  session_type text not null default '',
  unique (event_id, airtable_id)
);

create table if not exists public.speakers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  airtable_id text not null,
  name text not null default '',
  photo_url text not null default '',
  unique (event_id, airtable_id)
);

alter table public.objects
  add column if not exists appearance text check (appearance is null or appearance in ('booth', 'stage', 'custom')),
  add column if not exists facing_deg double precision not null default 0,
  add column if not exists model_asset_id uuid references public.library_assets(id) on delete set null,
  add column if not exists rug_texture_asset_id uuid references public.library_assets(id) on delete set null,
  add column if not exists wall_texture_asset_id uuid references public.library_assets(id) on delete set null;

alter table public.library_assets enable row level security;
alter table public.sessions enable row level security;
alter table public.speakers enable row level security;

create policy "editors manage library_assets"
  on public.library_assets for all
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

create policy "editors manage sessions"
  on public.sessions for all
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

create policy "editors manage speakers"
  on public.speakers for all
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
