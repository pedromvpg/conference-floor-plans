update public.event_exhibit_kits
set depth_m = 24, updated_at = now()
where kind = 'main_stage';
