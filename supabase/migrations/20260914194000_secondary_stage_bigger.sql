update public.event_exhibit_kits
set
  width_m = greatest(width_m, 16),
  depth_m = greatest(depth_m, 9),
  updated_at = now()
where kind = 'secondary_stage';
