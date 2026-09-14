alter table public.floors
  add column if not exists view_center jsonb;
