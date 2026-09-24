-- Read-only Stage 2 preservation comparison for 20260923030000_tier1_workflows.sql.
-- Before application, this fingerprints current full rows. After application,
-- subtract newly-added columns so the same original-column hashes still match.
-- Keep the owner/project link migrations separate; this only covers Tier 1.

select 'goals' as table_name, count(*)::bigint as row_count,
       md5(coalesce(string_agg(md5((to_jsonb(t)-array[]::text[])::text),'' order by t.id::text),'')) as original_columns_fingerprint
from public.goals t
union all
select 'operational_dependencies',count(*)::bigint,
       md5(coalesce(string_agg(md5((to_jsonb(t)-array[]::text[])::text),'' order by t.id::text),'')) from public.operational_dependencies t
union all
select 'executive_snapshots',count(*)::bigint,
       md5(coalesce(string_agg(md5((to_jsonb(t)-array['founder_facts'])::text),'' order by t.id::text),'')) from public.executive_snapshots t
union all
select 'decisions',count(*)::bigint,
       md5(coalesce(string_agg(md5((to_jsonb(t)-array['workflow','founder_required'])::text),'' order by t.id::text),'')) from public.decisions t
union all
select 'quality_incidents',count(*)::bigint,
       md5(coalesce(string_agg(md5((to_jsonb(t)-array['postmortem','postmortem_actions'])::text),'' order by t.id::text),'')) from public.quality_incidents t
union all
select 'tasks',count(*)::bigint,
       md5(coalesce(string_agg(md5((to_jsonb(t)-array['work_classification'])::text),'' order by t.id::text),'')) from public.tasks t
union all
select 'team_delegations',count(*)::bigint,
       md5(coalesce(string_agg(md5((to_jsonb(t)-array['founder_approval_required'])::text),'' order by t.id::text),'')) from public.team_delegations t
order by table_name;

-- Schema/RLS baseline: save this JSON alongside the result above before Stage 2.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       coalesce((select jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'definition',pg_get_constraintdef(x.oid)) order by x.conname)
                 from pg_constraint x where x.conrelid=c.oid),'[]'::jsonb) as constraints,
       coalesce((select jsonb_agg(jsonb_build_object('name',i.indexname,'definition',i.indexdef) order by i.indexname)
                 from pg_indexes i where i.schemaname='public' and i.tablename=c.relname),'[]'::jsonb) as indexes,
       coalesce((select jsonb_agg(jsonb_build_object('name',p.policyname,'roles',p.roles,'command',p.cmd,'using',p.qual,'check',p.with_check) order by p.policyname)
                 from pg_policies p where p.schemaname='public' and p.tablename=c.relname),'[]'::jsonb) as policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('goals','operational_dependencies','executive_snapshots','decisions','quality_incidents','tasks','team_delegations')
order by c.relname;
