update public.event_exhibit_kits
set depth_m = 13, updated_at = now()
where kind = 'secondary_stage';
