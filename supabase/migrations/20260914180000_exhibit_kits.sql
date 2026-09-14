create table if not exists public.event_exhibit_kits (
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (
    kind in (
      'extra_large',
      'large',
      'medium',
      'small',
      'kiosk',
      'main_stage',
      'secondary_stage'
    )
  ),
  width_m double precision not null,
  depth_m double precision not null,
  wall_height_m double precision not null,
  platform_height_m double precision,
  instructions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, kind)
);

alter table public.event_exhibit_kits enable row level security;

create policy "editors manage event_exhibit_kits"
  on public.event_exhibit_kits for all
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

alter table public.objects drop constraint if exists objects_appearance_check;
alter table public.objects
  add constraint objects_appearance_check
  check (appearance is null or appearance in ('booth', 'stage', 'custom', 'kiosk'));

alter table public.objects
  add column if not exists kit_kind text
  check (
    kit_kind is null
    or kit_kind in (
      'extra_large',
      'large',
      'medium',
      'small',
      'kiosk',
      'main_stage',
      'secondary_stage'
    )
  );

insert into public.event_exhibit_kits (event_id, kind, width_m, depth_m, wall_height_m, platform_height_m, instructions)
select e.id, v.kind, v.width_m, v.depth_m, v.wall_height_m, v.platform_height_m, v.instructions
from public.events e
cross join (
  values
    ('kiosk', 2::double precision, 2::double precision, 2.2::double precision, null::double precision, ''),
    ('small', 3, 3, 2.5, null, ''),
    ('medium', 6, 3, 2.5, null, ''),
    ('large', 6, 6, 2.5, null, ''),
    ('extra_large', 9, 9, 3.5, null, ''),
    ('main_stage', 12, 8, 4.2, 0.4, ''),
    ('secondary_stage', 8, 5, 3.5, 0.4, '')
) as v(kind, width_m, depth_m, wall_height_m, platform_height_m, instructions)
on conflict (event_id, kind) do nothing;

update public.event_exhibit_kits k
set
  width_m = v.width_m,
  depth_m = v.depth_m,
  wall_height_m = v.wall_height_m,
  platform_height_m = v.platform_height_m,
  instructions = v.instructions,
  updated_at = now()
from public.events e,
  (
    values
      ('kiosk', 2::double precision, 2::double precision, 2.2::double precision, null::double precision, 'Portal kiosk scale (~0.9 of the XR lintel model). Open front, slim posts.'),
      ('small', 3, 3, 2.5, null, 'S-BOOTH zone from Bitcoin Asia XR.'),
      ('medium', 3, 6, 2.8, null, 'M-BOOTH zone: 3 × 6 m, wall 2.8 m.'),
      ('large', 6, 6, 2.8, null, 'L-BOOTH zone from Bitcoin Asia XR.'),
      ('extra_large', 9.1, 8.9, 3.5, null, 'XL BOOTH zone 9.1 × 8.9 m, wall 3.5 m.'),
      ('main_stage', 18, 8.5, 4.5, 0.9, 'XR main stage: 18 × 0.9 × 8.5 m purple platform; five LED panels (12 / 4 / 8 m × 4.5 m); truss; chairs LOD at 30 m.'),
      ('secondary_stage', 14, 5, 3.5, 0.75, 'Genesis stage: 14 × 0.75 × 5 m orange platform, emissive LED wall, seats facing stage, LOD at 20 m.')
  ) as v(kind, width_m, depth_m, wall_height_m, platform_height_m, instructions)
where k.event_id = e.id
  and e.slug = 'bhk26'
  and k.kind = v.kind;
