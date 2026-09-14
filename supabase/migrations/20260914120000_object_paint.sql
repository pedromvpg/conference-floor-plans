alter table public.objects
  add column if not exists paint jsonb;
