update public.event_exhibit_kits k
set
  width_m = 6,
  depth_m = 3,
  updated_at = now()
from public.events e
where k.event_id = e.id
  and e.slug = 'bhk26'
  and k.kind = 'medium';
