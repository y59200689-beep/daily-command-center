-- Existing mission plans gain distinct inbound-reply and meeting logs without replacing custom actions.
update public.revenue_mission_settings
set daily_actions = coalesce(daily_actions, '[]'::jsonb)
  || case when not coalesce(daily_actions, '[]'::jsonb) @> '[{"id":"inbound_replies"}]'::jsonb then '[{"id":"inbound_replies","title":"Log replies received","daily_target":2,"active":true}]'::jsonb else '[]'::jsonb end
  || case when not coalesce(daily_actions, '[]'::jsonb) @> '[{"id":"meetings"}]'::jsonb then '[{"id":"meetings","title":"Log completed sales meetings","daily_target":1,"active":true}]'::jsonb else '[]'::jsonb end,
  updated_at = now();
