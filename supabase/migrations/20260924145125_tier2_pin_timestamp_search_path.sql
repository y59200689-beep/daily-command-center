-- Keep trigger timestamp resolution independent of caller-controlled schemas.
alter function public.set_updated_at() set search_path = '';
