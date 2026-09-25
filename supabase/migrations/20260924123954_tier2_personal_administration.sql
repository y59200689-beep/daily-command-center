-- Tier 2C additive personal metadata. Apply locally until activation is authorized.
alter table public.personal_balance_entries drop constraint personal_balance_entries_category_check;
alter table public.personal_balance_entries add constraint personal_balance_entries_category_check check(category in ('cash','bank','investment','crypto','vehicle','property','business_equity','receivable','loan','credit','tax','obligation','other'));
alter table public.personal_balance_entries
 add column owner_label text check(length(owner_label)<=240),
 add column liquidity_class text check(liquidity_class in ('immediate','short_term','illiquid','unknown')),
 add column due_date date, add column payment_amount numeric check(payment_amount>=0),
 add column interest_notes text check(length(interest_notes)<=2000),
 add column material boolean not null default false;
alter table public.personal_balance_history add column category text, add column liquid boolean;
create or replace function public.founder_wealth_history() returns trigger language plpgsql set search_path=public as $$
begin
 insert into public.personal_balance_history(user_id,entry_id,valued_on,kind,amount,currency,category,liquid)
 values(new.user_id,new.id,new.valued_on,new.kind,new.amount,new.currency,new.category,new.liquid)
 on conflict(user_id,entry_id,valued_on) do update set amount=excluded.amount,kind=excluded.kind,currency=excluded.currency,category=excluded.category,liquid=excluded.liquid,updated_at=now();
 return new;
end $$;
revoke all on function public.founder_wealth_history() from public,anon,authenticated;
alter table public.trips
 add column actual_departure date, add column visa_start date,
 add column insurance_expiry date, add column administrative_deadline date,
 add column administrative_status text check(administrative_status in ('unknown','pending','ready','blocked')),
 add column passport_required boolean not null default false,
 add column passport_document_id uuid references public.personal_documents(id),
 add column accommodation_notes text check(length(accommodation_notes)<=2000),
 add constraint tier2_actual_departure_order check(actual_departure is null or start_date is null or actual_departure>=start_date),
 add constraint tier2_visa_date_order check(visa_start is null or visa_expiry is null or visa_expiry>=visa_start);
create trigger tier2_trip_document_owner before insert or update on public.trips for each row execute function public.validate_v7_owned_link('passport_document_id','personal_documents');
alter table public.personal_documents drop constraint personal_documents_type_check;
alter table public.personal_documents add constraint personal_documents_type_check check(type in ('passport','visa','business_license','national_id','residence_permit','travel_insurance','vaccination_certificate','driving_permit','insurance','bank_document','vehicle_document','membership','certificate','contract','other'));
alter table public.personal_documents
 add column owner_label text check(length(owner_label)<=240),
 add column verification_status text not null default 'unverified' check(verification_status in ('unverified','verified','needs_review')),
 add column reminder_days integer not null default 30 check(reminder_days in (7,14,30,90,180));
