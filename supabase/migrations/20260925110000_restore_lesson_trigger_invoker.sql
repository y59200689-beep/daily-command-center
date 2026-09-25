-- Keep automatic lesson proposals under the caller's permissions and owner RLS.
-- The Tier 3 migration briefly changed this trigger to SECURITY DEFINER.
alter function public.founder_propose_lesson() security invoker;
