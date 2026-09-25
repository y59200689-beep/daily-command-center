-- Supabase may grant anon EXECUTE through default privileges independently of PUBLIC.
-- Keep the Founder RPC boundary authenticated-only without changing RLS or data.
begin;
revoke execute on function public.founder_kpi_values(date) from anon;
revoke execute on function public.search_founder_records(text,integer) from anon;
commit;
