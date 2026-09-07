-- V9 is an additive private research layer. Existing notes, files, decisions, and search stay canonical.
create table if not exists research_topics (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240), description text, status text not null default 'active' check (status in ('active','monitoring','paused','complete','archived')),
  domain text not null default 'other' check (domain in ('work','business','founder','life','strategy','personal','other')),
  priority text not null default 'medium' check (priority in ('low','medium','high')), last_reviewed_at timestamptz, next_review_at date, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists knowledge_sources (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 400), source_type text not null default 'manual' check (source_type in ('web','article','report','pdf','book','email','drive_file','internal_note','meeting','dataset','video','podcast','person','manual','other')),
  url text check (url is null or url ~* '^https?://[^[:space:]]+$'), author text, publisher text, published_at date, accessed_at timestamptz,
  notes text, reliability text check (reliability is null or reliability in ('primary','strong','useful','unverified','weak')),
  freshness_expires_at date, attachment_id uuid references attachments(id) on delete set null, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists research_findings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, topic_id uuid not null references research_topics(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 400), summary text not null default '', status text not null default 'draft' check (status in ('draft','supported','mixed','contradicted','superseded')),
  confidence_label text check (confidence_label is null or confidence_label in ('low','medium','high')), reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists finding_evidence (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, finding_id uuid not null references research_findings(id) on delete cascade,
  source_id uuid not null references knowledge_sources(id) on delete cascade, relation_type text not null check (relation_type in ('supports','contradicts','context','weak_support')), excerpt text check (excerpt is null or length(excerpt)<=2000), created_at timestamptz not null default now(), unique(finding_id,source_id,relation_type)
);
create table if not exists research_questions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, topic_id uuid not null references research_topics(id) on delete cascade,
  question text not null check (length(trim(question)) between 1 and 1000), status text not null default 'open' check (status in ('open','researching','answered','deferred','dropped')),
  priority text not null default 'medium' check (priority in ('low','medium','high')), answer_summary text, answered_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists research_question_findings (user_id uuid not null references auth.users(id) on delete cascade, question_id uuid not null references research_questions(id) on delete cascade, finding_id uuid not null references research_findings(id) on delete cascade, created_at timestamptz not null default now(), primary key(question_id,finding_id));
create table if not exists knowledge_collections (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null check(length(trim(title)) between 1 and 240), description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists collection_items (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, collection_id uuid not null references knowledge_collections(id) on delete cascade, item_type text not null, item_id uuid not null, created_at timestamptz not null default now(), unique(collection_id,item_type,item_id));
create table if not exists knowledge_entity_links (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, knowledge_type text not null check (knowledge_type in ('topic','source','finding','question','brief','collection')), knowledge_id uuid not null, entity_type text not null, entity_id uuid not null, created_at timestamptz not null default now(), unique(knowledge_type,knowledge_id,entity_type,entity_id));
create table if not exists knowledge_relations (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, from_type text not null, from_id uuid not null, to_type text not null, to_id uuid not null, relation_type text not null check (relation_type in ('related','supports','contradicts','derived_from','supersedes','depends_on','impacts','about')), created_at timestamptz not null default now(), check (from_type<>to_type or from_id<>to_id), unique(from_type,from_id,to_type,to_id,relation_type));
create table if not exists research_briefs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, topic_id uuid references research_topics(id) on delete set null, title text not null check(length(trim(title)) between 1 and 240), summary text not null default '', implications text, next_research text, status text not null default 'draft' check(status in ('draft','current','outdated','archived')), reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists watch_entities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, topic_id uuid references research_topics(id) on delete set null, name text not null check(length(trim(name)) between 1 and 240), watch_type text not null default 'other', status text not null default 'active' check(status in ('active','paused','archived')), last_checked_at timestamptz, next_check_at date, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists watch_updates (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, watch_id uuid not null references watch_entities(id) on delete cascade, update_type text not null default 'observation', summary text not null check(length(trim(summary)) between 1 and 4000), observed_at timestamptz not null default now(), created_at timestamptz not null default now());

do $$ declare t text; begin foreach t in array array['research_topics','knowledge_sources','research_findings','finding_evidence','research_questions','research_question_findings','knowledge_collections','collection_items','knowledge_entity_links','knowledge_relations','research_briefs','watch_entities','watch_updates'] loop execute format('alter table %I enable row level security',t); execute format('create policy %I_owner_all on %I for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',t,t); execute format('grant select,insert,update,delete on table %I to authenticated',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['research_topics','knowledge_sources','research_findings','research_questions','knowledge_collections','research_briefs','watch_entities'] loop execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()',t,t); end loop; end $$;
create index if not exists research_topics_owner_status_review_idx on research_topics(user_id,status,next_review_at);
create index if not exists knowledge_sources_owner_freshness_idx on knowledge_sources(user_id,freshness_expires_at) where archived_at is null;
create index if not exists research_findings_owner_topic_status_idx on research_findings(user_id,topic_id,status);
create index if not exists research_questions_owner_topic_status_idx on research_questions(user_id,topic_id,status);
create index if not exists knowledge_links_owner_entity_idx on knowledge_entity_links(user_id,entity_type,entity_id);
create index if not exists watch_entities_owner_next_check_idx on watch_entities(user_id,next_check_at) where status='active';
