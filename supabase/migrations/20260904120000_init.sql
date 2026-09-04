-- Conference map designer — map-owned Supabase schema
create extension if not exists "pgcrypto";

create table if not exists public.allowed_editors (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  airtable_base_id text not null default '',
  airtable_table text not null default '',
  airtable_token text not null default '',
  airtable_event_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  underlay_url text,
  original_url text,
  calibration jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  airtable_id text not null,
  name text not null,
  tier text not null default '',
  booth_number text not null default '',
  logo_url text not null default '',
  logo_white_url text not null default '',
  unique (event_id, airtable_id)
);

create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  kind text not null check (kind in ('booth', 'amenity')),
  polygon jsonb,
  x double precision,
  y double precision,
  rotation double precision not null default 0,
  booth_number text not null default '',
  name text not null default '',
  sponsor_id uuid references public.sponsors(id) on delete set null,
  amenity_type text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  published_by text not null default ''
);

alter table public.allowed_editors enable row level security;
alter table public.events enable row level security;
alter table public.floors enable row level security;
alter table public.sponsors enable row level security;
alter table public.objects enable row level security;
alter table public.publications enable row level security;

-- Public can read published snapshots only. Draft tables are service-role from the app.
create policy "publications are publicly readable"
  on public.publications for select
  using (true);

create policy "anon cannot read events"
  on public.events for select
  using (false);

-- Authenticated editors: allow all if their email is in allowed_editors
create policy "editors manage events"
  on public.events for all
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

create policy "editors manage floors"
  on public.floors for all
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

create policy "editors manage objects"
  on public.objects for all
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

create policy "editors manage sponsors"
  on public.sponsors for all
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

create policy "editors insert publications"
  on public.publications for insert
  with check (
    exists (
      select 1 from public.allowed_editors e
      where e.email = lower(auth.jwt() ->> 'email')
    )
  );

create policy "editors delete publications"
  on public.publications for delete
  using (
    exists (
      select 1 from public.allowed_editors e
      where e.email = lower(auth.jwt() ->> 'email')
    )
  );

create policy "editors read allowlist"
  on public.allowed_editors for select
  using (auth.role() = 'authenticated');

-- Storage bucket `maps` must be created as public in the dashboard.
-- Objects under published/ and logos/ are public; originals/ can be public too.
