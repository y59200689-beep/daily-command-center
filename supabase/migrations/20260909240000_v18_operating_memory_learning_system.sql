-- V18: Operating Memory & Learning System
-- 14 Additive tables with strict RLS (auth.uid() = user_id).
-- DO NOT APPLY THIS MIGRATION (Pending user migration deployment policy).

-- 1. Operating Lessons
create table if not exists operating_lessons (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  statement text not null,
  why_proposed text not null,
  domain text not null,
  scope text not null default 'business' check (scope in ('business', 'personal')),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'needs_review', 'superseded', 'retired', 'rejected')),
  confidence_state text not null default 'insufficient' check (confidence_state in ('insufficient', 'weak', 'moderate', 'strong', 'conflicting')),
  evidence_count integer default 0 not null,
  counterexample_count integer default 0 not null,
  last_reviewed_at timestamptz,
  review_at timestamptz,
  effective_from timestamptz,
  effective_until timestamptz,
  suggested_use text,
  potential_consequences text,
  superseded_by uuid references operating_lessons(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table operating_lessons enable row level security;
create policy "Users can manage their own operating_lessons"
  on operating_lessons for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_operating_lessons_user on operating_lessons(user_id);
create index if not exists idx_operating_lessons_domain on operating_lessons(domain);
create index if not exists idx_operating_lessons_status on operating_lessons(status);
create index if not exists idx_operating_lessons_scope on operating_lessons(scope);
create index if not exists idx_operating_lessons_review_at on operating_lessons(review_at);

-- 2. Lesson Evidence Links
create table if not exists lesson_evidence_links (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid references operating_lessons(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  source_table text not null,
  source_id text not null,
  is_counterexample boolean default false not null,
  source_quality text default 'verified_data' not null,
  description text not null,
  created_at timestamptz default now() not null
);

alter table lesson_evidence_links enable row level security;
create policy "Users can manage their own lesson_evidence_links"
  on lesson_evidence_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_lesson_evidence_links_lesson on lesson_evidence_links(lesson_id);
create index if not exists idx_lesson_evidence_links_user on lesson_evidence_links(user_id);

-- 3. Lesson Entity Links
create table if not exists lesson_entity_links (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid references operating_lessons(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_type text not null,
  entity_id text not null,
  entity_name text,
  created_at timestamptz default now() not null
);

alter table lesson_entity_links enable row level security;
create policy "Users can manage their own lesson_entity_links"
  on lesson_entity_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_lesson_entity_links_lesson on lesson_entity_links(lesson_id);
create index if not exists idx_lesson_entity_links_entity on lesson_entity_links(entity_type, entity_id);

-- 4. Lesson Reviews (Audit Log)
create table if not exists lesson_reviews (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid references operating_lessons(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  action text not null check (action in ('proposed', 'accepted', 'rejected', 'edited', 'superseded', 'retired')),
  notes text,
  reviewed_at timestamptz default now() not null
);

alter table lesson_reviews enable row level security;
create policy "Users can manage their own lesson_reviews"
  on lesson_reviews for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_lesson_reviews_lesson on lesson_reviews(lesson_id);

-- 5. Operating Patterns
create table if not exists operating_patterns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  pattern_key text not null,
  domain text not null,
  pattern_type text not null,
  entity_type text,
  entity_id text,
  title text not null,
  description text not null,
  observation_count integer default 1 not null,
  counterexample_count integer default 0 not null,
  confidence text not null default 'emerging' check (confidence in ('emerging', 'supported', 'strong')),
  suggested_action text,
  status text not null default 'active',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table operating_patterns enable row level security;
create policy "Users can manage their own operating_patterns"
  on operating_patterns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_operating_patterns_user on operating_patterns(user_id);
create index if not exists idx_operating_patterns_domain on operating_patterns(domain);
create index if not exists idx_operating_patterns_type on operating_patterns(pattern_type);

-- 6. Pattern Evidence
create table if not exists pattern_evidence (
  id uuid default gen_random_uuid() primary key,
  pattern_id uuid references operating_patterns(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  observation_text text not null,
  context jsonb default '{}'::jsonb,
  observed_at timestamptz default now() not null
);

alter table pattern_evidence enable row level security;
create policy "Users can manage their own pattern_evidence"
  on pattern_evidence for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_pattern_evidence_pattern on pattern_evidence(pattern_id);

-- 7. Pattern Counterexamples
create table if not exists pattern_counterexamples (
  id uuid default gen_random_uuid() primary key,
  pattern_id uuid references operating_patterns(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  reason text not null,
  context jsonb default '{}'::jsonb,
  observed_at timestamptz default now() not null
);

alter table pattern_counterexamples enable row level security;
create policy "Users can manage their own pattern_counterexamples"
  on pattern_counterexamples for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_pattern_counterexamples_pattern on pattern_counterexamples(pattern_id);

-- 8. Recommendation Feedback
create table if not exists recommendation_feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  recommendation_id text not null,
  recommendation_type text not null,
  domain text not null,
  entity_id text,
  rating text not null check (rating in ('helpful', 'not_useful', 'wrong')),
  comment text,
  created_at timestamptz default now() not null
);

alter table recommendation_feedback enable row level security;
create policy "Users can manage their own recommendation_feedback"
  on recommendation_feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_recommendation_feedback_type on recommendation_feedback(recommendation_type, domain);

-- 9. Recommendation Outcomes
create table if not exists recommendation_outcomes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  recommendation_id text not null,
  action_id text,
  outcome_state text not null check (outcome_state in ('matched', 'better', 'worse', 'mixed', 'unknown', 'too_early', 'pending')),
  achieved boolean default false not null,
  notes text,
  created_at timestamptz default now() not null
);

alter table recommendation_outcomes enable row level security;
create policy "Users can manage their own recommendation_outcomes"
  on recommendation_outcomes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_recommendation_outcomes_rec on recommendation_outcomes(recommendation_id);

-- 10. Forecast Evaluations
create table if not exists forecast_evaluations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  metric text not null,
  domain text not null,
  entity_id text,
  expected_value numeric not null,
  actual_value numeric not null,
  variance numeric not null,
  variance_percentage numeric not null,
  direction text not null check (direction in ('over', 'under', 'accurate')),
  timing_variance_days integer default 0 not null,
  calibration_proposal text,
  snapshot_date timestamptz not null,
  recorded_date timestamptz default now() not null,
  explanation text,
  created_at timestamptz default now() not null
);

alter table forecast_evaluations enable row level security;
create policy "Users can manage their own forecast_evaluations"
  on forecast_evaluations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_forecast_evaluations_domain on forecast_evaluations(domain);
create index if not exists idx_forecast_evaluations_metric on forecast_evaluations(metric);

-- 11. Retrospectives
create table if not exists retrospectives (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  retro_type text not null check (retro_type in ('project', 'client', 'incident', 'campaign', 'decision', 'quarter', 'custom')),
  domain text not null,
  entity_type text,
  entity_id text,
  period text,
  expected_summary text,
  actual_summary text,
  status text not null default 'draft' check (status in ('draft', 'completed', 'archived')),
  reviewed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table retrospectives enable row level security;
create policy "Users can manage their own retrospectives"
  on retrospectives for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_retrospectives_domain on retrospectives(domain);
create index if not exists idx_retrospectives_type on retrospectives(retro_type);

-- 12. Retrospective Items
create table if not exists retrospective_items (
  id uuid default gen_random_uuid() primary key,
  retrospective_id uuid references retrospectives(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in ('went_well', 'didnt_go_well', 'surprise', 'action_item', 'lesson_candidate')),
  content text not null,
  order_index integer default 0 not null,
  created_at timestamptz default now() not null
);

alter table retrospective_items enable row level security;
create policy "Users can manage their own retrospective_items"
  on retrospective_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_retrospective_items_retro on retrospective_items(retrospective_id);

-- 13. Learning Rule Proposals
create table if not exists learning_rule_proposals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  lesson_id uuid references operating_lessons(id) on delete set null,
  title text not null,
  rule_type text not null check (rule_type in ('threshold', 'default_assumption', 'planning_buffer', 'review_cadence', 'risk_trigger', 'recommendation_modifier')),
  domain text not null,
  scope text not null default 'business' check (scope in ('business', 'personal')),
  current_value jsonb not null,
  proposed_value jsonb not null,
  affected_domains text[] default '{}'::text[],
  expected_effect text not null,
  risks text[] default '{}'::text[],
  rollback_path text not null,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected', 'retired')),
  accepted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table learning_rule_proposals enable row level security;
create policy "Users can manage their own learning_rule_proposals"
  on learning_rule_proposals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_learning_rule_proposals_domain on learning_rule_proposals(domain);
create index if not exists idx_learning_rule_proposals_status on learning_rule_proposals(status);

-- 14. Memory Supersessions
create table if not exists memory_supersessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  old_lesson_id uuid references operating_lessons(id) on delete cascade not null,
  new_lesson_id uuid references operating_lessons(id) on delete cascade not null,
  reason text not null,
  superseded_at timestamptz default now() not null
);

alter table memory_supersessions enable row level security;
create policy "Users can manage their own memory_supersessions"
  on memory_supersessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_memory_supersessions_user on memory_supersessions(user_id);
