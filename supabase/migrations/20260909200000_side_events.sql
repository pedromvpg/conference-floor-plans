alter table public.objects drop constraint if exists objects_kind_check;
alter table public.objects
  add constraint objects_kind_check check (kind in ('booth', 'amenity', 'side_event'));

alter table public.objects
  add column if not exists description text not null default '',
  add column if not exists event_date text not null default '';
