update public.event_exhibit_kits
set instructions = '', updated_at = now()
where instructions <> '';
