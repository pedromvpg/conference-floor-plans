alter table public.objects
  add column if not exists logo_asset_id uuid references public.library_assets(id) on delete set null,
  add column if not exists fill_texture_asset_id uuid references public.library_assets(id) on delete set null;
