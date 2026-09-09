alter table public.objects drop constraint if exists objects_kind_check;
alter table public.objects
  add constraint objects_kind_check check (kind in ('booth', 'amenity', 'side_event', 'hotel'));
