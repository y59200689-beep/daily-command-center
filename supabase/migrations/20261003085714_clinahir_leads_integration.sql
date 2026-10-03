-- Extend the existing owner-scoped leads system; retain its RLS and statuses.
begin;
alter table public.leads drop constraint leads_source_check;
alter table public.leads add constraint leads_source_check check (source in (
  'referral','instagram','website','email','whatsapp_manual','networking','existing_client','other','clinahir'
));
alter table public.leads
  add column city text check (city is null or length(city) <= 120),
  add column external_id text check (external_id is null or length(trim(external_id)) between 1 and 200),
  add column source_detail text,
  add column metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object');
-- Includes archived leads: retrying a submission must not resurrect it.
create unique index leads_external_submission_unique
  on public.leads (user_id, source, external_id) where external_id is not null;
-- Keep integration identity stable when a normal editor updates the lead.
create function public.preserve_clinahir_lead_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.source = 'clinahir' and old.external_id is not null and (
    new.source is distinct from old.source or new.external_id is distinct from old.external_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Clinahir submission identity cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_clinahir_lead_identity() from public, anon, authenticated;
create trigger preserve_clinahir_lead_identity before update on public.leads
for each row execute function public.preserve_clinahir_lead_identity();
commit;
