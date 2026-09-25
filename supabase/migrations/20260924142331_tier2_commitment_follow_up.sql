-- Tier 2D: explicit promised follow-up dates, scoped to open owner records.
alter table public.operating_commitments
  add column if not exists follow_up_date date;

create index if not exists operating_commitments_follow_up_idx
  on public.operating_commitments(user_id, follow_up_date)
  where status = 'open' and follow_up_date is not null;
