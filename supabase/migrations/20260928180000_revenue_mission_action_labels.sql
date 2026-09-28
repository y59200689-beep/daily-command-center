-- Simplify the labels added in the preceding migration without changing customized names.
update public.revenue_mission_settings
set daily_actions = (
  select jsonb_agg(
    case
      when action->>'id' = 'inbound_replies' and action->>'title' = 'Log replies received' then jsonb_set(action, '{title}', '"Replies received"'::jsonb)
      when action->>'id' = 'meetings' and action->>'title' = 'Log completed sales meetings' then jsonb_set(action, '{title}', '"Sales meetings completed"'::jsonb)
      else action
    end order by ordinal
  ) from jsonb_array_elements(daily_actions) with ordinality as items(action, ordinal)
), updated_at = now()
where daily_actions @> '[{"id":"inbound_replies"}]'::jsonb or daily_actions @> '[{"id":"meetings"}]'::jsonb;
