update public.event_exhibit_kits
set depth_m = 16, updated_at = now()
where kind = 'main_stage' and depth_m <= 12;
