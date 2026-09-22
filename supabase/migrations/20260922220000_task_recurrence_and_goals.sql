-- ============================================================
-- Task Recurrence & Goal Tasks
-- Adds simple recurrence frequency and numeric progress tracking
-- ============================================================

-- Recurrence: human-friendly frequency (simpler than iCal RRULE)
alter table tasks
  add column if not exists recurrence_frequency text
  check (
    recurrence_frequency is null or
    recurrence_frequency in ('daily','weekly','monthly','mon','tue','wed','thu','fri','sat','sun')
  );

-- Goal / progress task columns
alter table tasks add column if not exists target_count  numeric(10,2) check (target_count is null or target_count > 0);
alter table tasks add column if not exists current_count numeric(10,2) not null default 0 check (current_count >= 0);
alter table tasks add column if not exists daily_target  numeric(10,2) check (daily_target is null or daily_target > 0);

-- Index for recurrence queries (used when spawning next occurrences)
create index if not exists tasks_recurrence_idx
  on tasks(user_id, recurrence_frequency)
  where deleted_at is null and recurrence_frequency is not null;
