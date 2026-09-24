-- Founder OS: additive extensions of canonical operational records.
-- No destructive data changes. Roll back application code first; preserve recorded data.
begin;
create table public.operating_risks (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.system_access_records (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.kpi_definitions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.kpi_observations (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.personal_balance_entries (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.operating_relationships (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.operating_commitments (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.asset_metadata (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.training_plans (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.training_observations (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.quality_incidents add column if not exists title text check (title is null or length(title) <= 240);
alter table public.quality_incidents add column if not exists description text check (description is null or length(description) <= 10000);
alter table public.quality_incidents add column if not exists status text default 'open' check (status in ('open','investigating','mitigating','blocked','resolved','closed','corrective_action','monitoring','archived'));
alter table public.quality_incidents add column if not exists severity text default 'medium' check (severity in ('medium','low','high','critical'));
alter table public.quality_incidents add column if not exists impact text default 'medium' check (impact in ('medium','low','high','critical'));
alter table public.quality_incidents add column if not exists urgency text default 'normal' check (urgency in ('normal','soon','immediate'));
alter table public.quality_incidents add column if not exists company_id uuid references public.companies(id);
alter table public.quality_incidents add column if not exists project_id uuid references public.projects(id);
alter table public.quality_incidents add column if not exists owner_label text check (owner_label is null or length(owner_label) <= 240);
alter table public.quality_incidents add column if not exists target_resolution_date date;
alter table public.quality_incidents add column if not exists revenue_exposure numeric check (revenue_exposure is null or (revenue_exposure >= 0 and revenue_exposure <= 1000000000000000));
alter table public.quality_incidents add column if not exists currency text default 'MAD' check (currency is null or length(currency) <= 240);
alter table public.quality_incidents add column if not exists customer_exposure text check (customer_exposure is null or length(customer_exposure) <= 10000);
alter table public.quality_incidents add column if not exists operational_exposure text check (operational_exposure is null or length(operational_exposure) <= 10000);
alter table public.quality_incidents add column if not exists founder_required boolean default false;
alter table public.quality_incidents add column if not exists corrective_task_id uuid references public.tasks(id);
alter table public.quality_incidents add column if not exists system_id uuid references public.operational_systems(id);
alter table public.quality_incidents add column if not exists root_cause text check (root_cause is null or length(root_cause) <= 10000);
alter table public.quality_incidents add column if not exists corrective_action text check (corrective_action is null or length(corrective_action) <= 10000);
alter table public.quality_incidents add column if not exists preventive_action text check (preventive_action is null or length(preventive_action) <= 10000);
alter table public.quality_incidents add column if not exists detection_gap text check (detection_gap is null or length(detection_gap) <= 10000);
alter table public.quality_incidents add column if not exists postmortem_required boolean default false;
create index if not exists quality_incidents_founder_owner_updated_idx on public.quality_incidents(user_id, updated_at desc);
alter table public.operating_risks add column if not exists title text not null check (title is null or length(title) <= 240);
alter table public.operating_risks add column if not exists category text default 'operational' not null check (category in ('operational','financial','technical','security','customer','supplier','legal','reputation','strategic','personal','travel','training'));
alter table public.operating_risks add column if not exists description text check (description is null or length(description) <= 10000);
alter table public.operating_risks add column if not exists status text default 'identified' not null check (status in ('identified','monitoring','mitigated','materialized','closed','accepted'));
alter table public.operating_risks add column if not exists probability numeric check (probability is null or (probability >= 1 and probability <= 5));
alter table public.operating_risks add column if not exists impact numeric check (impact is null or (impact >= 1 and impact <= 5));
alter table public.operating_risks add column if not exists exposure numeric check (exposure is null or (exposure >= 0 and exposure <= 1000000000000000));
alter table public.operating_risks add column if not exists currency text default 'MAD' not null check (currency is null or length(currency) <= 240);
alter table public.operating_risks add column if not exists early_warning text check (early_warning is null or length(early_warning) <= 240);
alter table public.operating_risks add column if not exists mitigation text check (mitigation is null or length(mitigation) <= 10000);
alter table public.operating_risks add column if not exists contingency text check (contingency is null or length(contingency) <= 10000);
alter table public.operating_risks add column if not exists review_date date;
alter table public.operating_risks add column if not exists owner_label text check (owner_label is null or length(owner_label) <= 240);
alter table public.operating_risks add column if not exists company_id uuid references public.companies(id);
alter table public.operating_risks add column if not exists project_id uuid references public.projects(id);
alter table public.operating_risks add column if not exists issue_id uuid references public.quality_incidents(id);
alter table public.operating_risks add column if not exists decision_id uuid references public.decisions(id);
create index if not exists operating_risks_founder_owner_updated_idx on public.operating_risks(user_id, updated_at desc);
alter table public.operating_risks enable row level security;
grant select, insert, update, delete on public.operating_risks to authenticated;
create policy operating_risks_owner_all on public.operating_risks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.operational_dependencies add column if not exists source_type text default 'task' check (source_type in ('task','project','issue','decision','person','business','system','obligation','commitment','sop','process','run','client','opportunity','supplier','product','campaign','calendar_event','integration','tool_system','approval','strategic_milestone'));
alter table public.operational_dependencies add column if not exists source_id uuid check (source_id is null or length(source_id) <= 240);
alter table public.operational_dependencies add column if not exists dependency_type text default 'task' check (dependency_type in ('task','project','issue','decision','person','business','system','obligation','commitment','sop','process','run','client','opportunity','supplier','product','campaign','calendar_event','integration','tool_system','approval','strategic_milestone'));
alter table public.operational_dependencies add column if not exists dependency_id uuid check (dependency_id is null or length(dependency_id) <= 240);
alter table public.operational_dependencies add column if not exists dependency_label text check (dependency_label is null or length(dependency_label) <= 240);
alter table public.operational_dependencies add column if not exists state text default 'ready' check (state in ('ready','waiting','blocked','unavailable','unknown'));
alter table public.operational_dependencies add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists operational_dependencies_founder_owner_updated_idx on public.operational_dependencies(user_id, updated_at desc);
alter table public.companies add column if not exists name text check (name is null or length(name) <= 240);
alter table public.companies add column if not exists industry text check (industry is null or length(industry) <= 240);
alter table public.companies add column if not exists owner_label text check (owner_label is null or length(owner_label) <= 240);
alter table public.companies add column if not exists description text check (description is null or length(description) <= 10000);
alter table public.companies add column if not exists strategic_objectives text check (strategic_objectives is null or length(strategic_objectives) <= 10000);
alter table public.companies add column if not exists active boolean default false;
alter table public.companies add column if not exists currency text default 'MAD' check (currency is null or length(currency) <= 240);
alter table public.companies add column if not exists primary_project_id uuid references public.projects(id);
create index if not exists companies_founder_owner_updated_idx on public.companies(user_id, updated_at desc);
alter table public.operational_systems add column if not exists name text check (name is null or length(name) <= 240);
alter table public.operational_systems add column if not exists provider text check (provider is null or length(provider) <= 240);
alter table public.operational_systems add column if not exists system_type text default 'other' check (system_type in ('other','domain','saas','hosting','database','payments','analytics','api','email','storage','monitoring','automation','ai'));
alter table public.operational_systems add column if not exists purpose text check (purpose is null or length(purpose) <= 240);
alter table public.operational_systems add column if not exists status text default 'unknown' check (status in ('unknown','active','degraded','unavailable','deprecated'));
alter table public.operational_systems add column if not exists criticality text default 'medium' check (criticality in ('medium','low','high','critical'));
alter table public.operational_systems add column if not exists company_id uuid references public.companies(id);
alter table public.operational_systems add column if not exists owner_label text check (owner_label is null or length(owner_label) <= 240);
alter table public.operational_systems add column if not exists external_url text;
alter table public.operational_systems add column if not exists repository_url text;
alter table public.operational_systems add column if not exists environment text default 'production' check (environment in ('production','staging','development'));
alter table public.operational_systems add column if not exists subscription_id uuid references public.subscriptions(id);
alter table public.operational_systems add column if not exists renewal_date date;
alter table public.operational_systems add column if not exists auto_renew boolean default false;
alter table public.operational_systems add column if not exists backup_status text default 'unknown' check (backup_status in ('unknown','verified','failed','not_configured'));
alter table public.operational_systems add column if not exists last_verified_date date;
alter table public.operational_systems add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists operational_systems_founder_owner_updated_idx on public.operational_systems(user_id, updated_at desc);
alter table public.system_access_records add column if not exists system_id uuid references public.operational_systems(id) not null;
alter table public.system_access_records add column if not exists person_label text not null check (person_label is null or length(person_label) <= 240);
alter table public.system_access_records add column if not exists person_id uuid references public.team_people(id);
alter table public.system_access_records add column if not exists access_level text default 'member' not null check (access_level in ('member','admin','owner','read_only'));
alter table public.system_access_records add column if not exists two_factor_enabled boolean default false;
alter table public.system_access_records add column if not exists recovery_path_exists boolean default false;
alter table public.system_access_records add column if not exists backup_admin boolean default false;
alter table public.system_access_records add column if not exists last_audit_date date;
create index if not exists system_access_records_founder_owner_updated_idx on public.system_access_records(user_id, updated_at desc);
alter table public.system_access_records enable row level security;
grant select, insert, update, delete on public.system_access_records to authenticated;
create policy system_access_records_owner_all on public.system_access_records for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.kpi_definitions add column if not exists name text not null check (name is null or length(name) <= 240);
alter table public.kpi_definitions add column if not exists company_id uuid references public.companies(id);
alter table public.kpi_definitions add column if not exists category text default 'revenue' not null check (category in ('revenue','customers','orders','growth','marketing','operations','finance','product','technology','team'));
alter table public.kpi_definitions add column if not exists unit text not null check (unit is null or length(unit) <= 240);
alter table public.kpi_definitions add column if not exists direction text default 'higher' not null check (direction in ('higher','lower'));
alter table public.kpi_definitions add column if not exists target numeric check (target is null or (target >= -1000000000000000 and target <= 1000000000000000));
alter table public.kpi_definitions add column if not exists warning_threshold numeric check (warning_threshold is null or (warning_threshold >= -1000000000000000 and warning_threshold <= 1000000000000000));
alter table public.kpi_definitions add column if not exists critical_threshold numeric check (critical_threshold is null or (critical_threshold >= -1000000000000000 and critical_threshold <= 1000000000000000));
alter table public.kpi_definitions add column if not exists source text default 'manual' not null check (source in ('manual','commerce_orders','commerce_revenue'));
alter table public.kpi_definitions add column if not exists frequency text default 'monthly' not null check (frequency in ('monthly','weekly','daily'));
alter table public.kpi_definitions add column if not exists active boolean default false;
create index if not exists kpi_definitions_founder_owner_updated_idx on public.kpi_definitions(user_id, updated_at desc);
alter table public.kpi_definitions enable row level security;
grant select, insert, update, delete on public.kpi_definitions to authenticated;
create policy kpi_definitions_owner_all on public.kpi_definitions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.kpi_observations add column if not exists kpi_id uuid references public.kpi_definitions(id) not null;
alter table public.kpi_observations add column if not exists observed_on date not null;
alter table public.kpi_observations add column if not exists value numeric not null check (value is null or (value >= -1000000000000000 and value <= 1000000000000000));
alter table public.kpi_observations add column if not exists source_reference text check (source_reference is null or length(source_reference) <= 240);
create index if not exists kpi_observations_founder_owner_updated_idx on public.kpi_observations(user_id, updated_at desc);
alter table public.kpi_observations enable row level security;
grant select, insert, update, delete on public.kpi_observations to authenticated;
create policy kpi_observations_owner_all on public.kpi_observations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.personal_balance_entries add column if not exists name text not null check (name is null or length(name) <= 240);
alter table public.personal_balance_entries add column if not exists kind text default 'asset' not null check (kind in ('asset','liability'));
alter table public.personal_balance_entries add column if not exists category text default 'cash' not null check (category in ('cash','bank','investment','crypto','vehicle','property','business_equity','loan','credit','obligation','other'));
alter table public.personal_balance_entries add column if not exists amount numeric not null check (amount is null or (amount >= 0 and amount <= 1000000000000000));
alter table public.personal_balance_entries add column if not exists currency text default 'MAD' not null check (currency is null or length(currency) <= 240);
alter table public.personal_balance_entries add column if not exists liquid boolean default false;
alter table public.personal_balance_entries add column if not exists valued_on date not null;
alter table public.personal_balance_entries add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists personal_balance_entries_founder_owner_updated_idx on public.personal_balance_entries(user_id, updated_at desc);
alter table public.personal_balance_entries enable row level security;
grant select, insert, update, delete on public.personal_balance_entries to authenticated;
create policy personal_balance_entries_owner_all on public.personal_balance_entries for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.operating_relationships add column if not exists name text not null check (name is null or length(name) <= 240);
alter table public.operating_relationships add column if not exists relationship_type text default 'partner' not null check (relationship_type in ('partner','customer','supplier','employee','contractor','agency','advisor','contact'));
alter table public.operating_relationships add column if not exists organization text check (organization is null or length(organization) <= 240);
alter table public.operating_relationships add column if not exists role text check (role is null or length(role) <= 240);
alter table public.operating_relationships add column if not exists owner_label text check (owner_label is null or length(owner_label) <= 240);
alter table public.operating_relationships add column if not exists company_id uuid references public.companies(id);
alter table public.operating_relationships add column if not exists client_id uuid references public.clients(id);
alter table public.operating_relationships add column if not exists supplier_id uuid references public.supplier_records(id);
alter table public.operating_relationships add column if not exists person_id uuid references public.team_people(id);
alter table public.operating_relationships add column if not exists importance text default 'medium' not null check (importance in ('medium','low','high','critical'));
alter table public.operating_relationships add column if not exists status text default 'unknown' not null check (status in ('unknown','healthy','attention','inactive'));
alter table public.operating_relationships add column if not exists last_interaction date;
alter table public.operating_relationships add column if not exists next_followup date;
alter table public.operating_relationships add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists operating_relationships_founder_owner_updated_idx on public.operating_relationships(user_id, updated_at desc);
alter table public.operating_relationships enable row level security;
grant select, insert, update, delete on public.operating_relationships to authenticated;
create policy operating_relationships_owner_all on public.operating_relationships for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.operating_commitments add column if not exists title text not null check (title is null or length(title) <= 240);
alter table public.operating_commitments add column if not exists person_label text not null check (person_label is null or length(person_label) <= 240);
alter table public.operating_commitments add column if not exists direction text default 'owed_to_me' not null check (direction in ('owed_to_me','owed_by_me'));
alter table public.operating_commitments add column if not exists status text default 'open' not null check (status in ('open','fulfilled','cancelled'));
alter table public.operating_commitments add column if not exists due_date date;
alter table public.operating_commitments add column if not exists importance text default 'medium' not null check (importance in ('medium','low','high','critical'));
alter table public.operating_commitments add column if not exists source text default 'manual' not null check (source in ('manual','email','whatsapp','call','meeting'));
alter table public.operating_commitments add column if not exists source_reference text check (source_reference is null or length(source_reference) <= 240);
alter table public.operating_commitments add column if not exists company_id uuid references public.companies(id);
alter table public.operating_commitments add column if not exists project_id uuid references public.projects(id);
alter table public.operating_commitments add column if not exists task_id uuid references public.tasks(id);
alter table public.operating_commitments add column if not exists waiting_id uuid references public.waiting_items(id);
alter table public.operating_commitments add column if not exists relationship_id uuid references public.operating_relationships(id);
alter table public.operating_commitments add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists operating_commitments_founder_owner_updated_idx on public.operating_commitments(user_id, updated_at desc);
alter table public.operating_commitments enable row level security;
grant select, insert, update, delete on public.operating_commitments to authenticated;
create policy operating_commitments_owner_all on public.operating_commitments for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.growth_experiments add column if not exists name text check (name is null or length(name) <= 240);
alter table public.growth_experiments add column if not exists hypothesis text check (hypothesis is null or length(hypothesis) <= 240);
alter table public.growth_experiments add column if not exists target_metric text check (target_metric is null or length(target_metric) <= 240);
alter table public.growth_experiments add column if not exists status text default 'idea' check (status in ('idea','planned','running','completed','cancelled'));
alter table public.growth_experiments add column if not exists company_id uuid references public.companies(id);
alter table public.growth_experiments add column if not exists project_id uuid references public.projects(id);
alter table public.growth_experiments add column if not exists start_date date;
alter table public.growth_experiments add column if not exists end_date date;
alter table public.growth_experiments add column if not exists baseline numeric check (baseline is null or (baseline >= -1000000000000000 and baseline <= 1000000000000000));
alter table public.growth_experiments add column if not exists target_value numeric check (target_value is null or (target_value >= -1000000000000000 and target_value <= 1000000000000000));
alter table public.growth_experiments add column if not exists actual_value numeric check (actual_value is null or (actual_value >= -1000000000000000 and actual_value <= 1000000000000000));
alter table public.growth_experiments add column if not exists direction text default 'higher' check (direction in ('higher','lower'));
alter table public.growth_experiments add column if not exists result text check (result is null or length(result) <= 10000);
alter table public.growth_experiments add column if not exists lesson text check (lesson is null or length(lesson) <= 10000);
alter table public.growth_experiments add column if not exists next_action text check (next_action is null or length(next_action) <= 10000);
alter table public.growth_experiments add column if not exists decision_id uuid references public.decisions(id);
create index if not exists growth_experiments_founder_owner_updated_idx on public.growth_experiments(user_id, updated_at desc);
alter table public.trips add column if not exists title text check (title is null or length(title) <= 240);
alter table public.trips add column if not exists destination_country text check (destination_country is null or length(destination_country) <= 240);
alter table public.trips add column if not exists status text default 'planning' check (status in ('planning','idea','booked','in_progress','completed','canceled'));
alter table public.trips add column if not exists start_date date;
alter table public.trips add column if not exists end_date date;
alter table public.trips add column if not exists visa_type text check (visa_type is null or length(visa_type) <= 240);
alter table public.trips add column if not exists visa_expiry date;
alter table public.trips add column if not exists allowed_stay_days numeric check (allowed_stay_days is null or (allowed_stay_days >= 1 and allowed_stay_days <= 3650));
alter table public.trips add column if not exists stay_source text check (stay_source is null or length(stay_source) <= 240);
alter table public.trips add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists trips_founder_owner_updated_idx on public.trips(user_id, updated_at desc);
alter table public.personal_documents add column if not exists label text check (label is null or length(label) <= 240);
alter table public.personal_documents add column if not exists type text default 'other' check (type in ('other','passport','national_id','residence_permit','travel_insurance','vaccination_certificate','driving_permit','insurance','bank_document','vehicle_document','membership','certificate','contract'));
alter table public.personal_documents add column if not exists country text check (country is null or length(country) <= 240);
alter table public.personal_documents add column if not exists issued_at date;
alter table public.personal_documents add column if not exists expires_at date;
alter table public.personal_documents add column if not exists issuer text check (issuer is null or length(issuer) <= 240);
alter table public.personal_documents add column if not exists storage_reference text check (storage_reference is null or length(storage_reference) <= 240);
alter table public.personal_documents add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists personal_documents_founder_owner_updated_idx on public.personal_documents(user_id, updated_at desc);
alter table public.asset_metadata add column if not exists name text not null check (name is null or length(name) <= 240);
alter table public.asset_metadata add column if not exists type text default 'other' not null check (type in ('other','image','video','logo','brand','contract','presentation','spreadsheet','report','creative','technical'));
alter table public.asset_metadata add column if not exists attachment_id uuid references public.attachments(id);
alter table public.asset_metadata add column if not exists content_id uuid references public.content_items(id);
alter table public.asset_metadata add column if not exists company_id uuid references public.companies(id);
alter table public.asset_metadata add column if not exists project_id uuid references public.projects(id);
alter table public.asset_metadata add column if not exists owner_label text check (owner_label is null or length(owner_label) <= 240);
alter table public.asset_metadata add column if not exists version text check (version is null or length(version) <= 240);
alter table public.asset_metadata add column if not exists status text default 'draft' not null check (status in ('draft','active','review','expired','archived'));
alter table public.asset_metadata add column if not exists source text check (source is null or length(source) <= 240);
alter table public.asset_metadata add column if not exists review_date date;
alter table public.asset_metadata add column if not exists expiry_date date;
alter table public.asset_metadata add column if not exists parent_asset_id uuid references public.asset_metadata(id);
alter table public.asset_metadata add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists asset_metadata_founder_owner_updated_idx on public.asset_metadata(user_id, updated_at desc);
alter table public.asset_metadata enable row level security;
grant select, insert, update, delete on public.asset_metadata to authenticated;
create policy asset_metadata_owner_all on public.asset_metadata for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.training_plans add column if not exists name text not null check (name is null or length(name) <= 240);
alter table public.training_plans add column if not exists status text default 'active' not null check (status in ('active','planned','completed','archived'));
alter table public.training_plans add column if not exists methodology text not null check (methodology is null or length(methodology) <= 240);
alter table public.training_plans add column if not exists start_date date;
alter table public.training_plans add column if not exists end_date date;
alter table public.training_plans add column if not exists race_date date;
alter table public.training_plans add column if not exists weekly_sessions numeric check (weekly_sessions is null or (weekly_sessions >= 0 and weekly_sessions <= 100));
alter table public.training_plans add column if not exists weekly_minutes numeric check (weekly_minutes is null or (weekly_minutes >= 0 and weekly_minutes <= 10080));
alter table public.training_plans add column if not exists maximum_weekly_increase numeric check (maximum_weekly_increase is null or (maximum_weekly_increase >= 0 and maximum_weekly_increase <= 300));
alter table public.training_plans add column if not exists minimum_sleep_hours numeric check (minimum_sleep_hours is null or (minimum_sleep_hours >= 0 and minimum_sleep_hours <= 24));
alter table public.training_plans add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists training_plans_founder_owner_updated_idx on public.training_plans(user_id, updated_at desc);
alter table public.training_plans enable row level security;
grant select, insert, update, delete on public.training_plans to authenticated;
create policy training_plans_owner_all on public.training_plans for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.training_observations add column if not exists observed_on date not null;
alter table public.training_observations add column if not exists sleep_hours numeric check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24));
alter table public.training_observations add column if not exists resting_hr numeric check (resting_hr is null or (resting_hr >= 20 and resting_hr <= 240));
alter table public.training_observations add column if not exists body_weight numeric check (body_weight is null or (body_weight >= 1 and body_weight <= 500));
alter table public.training_observations add column if not exists recovery text default 'unknown' not null check (recovery in ('unknown','good','fair','poor'));
alter table public.training_observations add column if not exists notes text check (notes is null or length(notes) <= 10000);
create index if not exists training_observations_founder_owner_updated_idx on public.training_observations(user_id, updated_at desc);
alter table public.training_observations enable row level security;
grant select, insert, update, delete on public.training_observations to authenticated;
create policy training_observations_owner_all on public.training_observations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Expand existing enums without removing any supported legacy value.
alter table public.quality_incidents drop constraint quality_incidents_status_check;
alter table public.quality_incidents add constraint quality_incidents_status_check check (status in ('open','investigating','mitigating','blocked','resolved','closed','corrective_action','monitoring','archived'));
alter table public.operational_dependencies drop constraint operational_dependencies_source_type_check;
alter table public.operational_dependencies drop constraint operational_dependencies_dependency_type_check;
alter table public.operational_dependencies add constraint operational_dependencies_source_type_check check (source_type in ('task','project','issue','decision','person','business','system','obligation','commitment','sop','process','run','client','opportunity','supplier','product','campaign','calendar_event','integration','tool_system','approval','strategic_milestone'));
alter table public.operational_dependencies add constraint operational_dependencies_dependency_type_check check (dependency_type in ('task','project','issue','decision','person','business','system','obligation','commitment','sop','process','run','client','opportunity','supplier','product','campaign','calendar_event','integration','tool_system','approval','strategic_milestone','other'));

alter table public.decisions add column if not exists options_considered text;
alter table public.decisions add column if not exists selected_option text;
alter table public.decisions add column if not exists assumptions text;
alter table public.decisions add column if not exists expected_outcome text;
alter table public.decisions add column if not exists expected_metric text;
alter table public.decisions add column if not exists actual_outcome text;
alter table public.decisions add column if not exists variance text;
alter table public.decisions add column if not exists lesson_learned text;
alter table public.decisions add column if not exists owner_label text;
alter table public.decisions add column if not exists reversibility text check(reversibility in ('reversible','costly','irreversible'));
alter table public.decisions add column if not exists financial_exposure numeric check(financial_exposure >= 0);
alter table public.decisions add column if not exists currency text default 'MAD';
alter table public.decisions add column if not exists deadline date;
alter table public.decisions add column if not exists company_id uuid references public.companies(id);
alter table public.waiting_items add column if not exists followup_date date;
alter table public.waiting_items add column if not exists importance text default 'medium' check(importance in ('low','medium','high','critical'));
alter table public.waiting_items add column if not exists direction text default 'owed_to_me' check(direction in ('owed_to_me','owed_by_me'));
alter table public.waiting_items add column if not exists impact text;
alter table public.waiting_items add column if not exists task_id uuid references public.tasks(id);
alter table public.waiting_items add column if not exists company_id uuid references public.companies(id);
alter table public.waiting_items add column if not exists owner_label text;
alter table public.waiting_items add column if not exists blocking_revenue boolean not null default false;
alter table public.personal_documents add column if not exists issuer text;
alter table public.personal_documents add column if not exists storage_reference text;
alter table public.operating_lessons add column if not exists source_table text;
alter table public.operating_lessons add column if not exists source_id uuid;
create unique index operating_lessons_founder_source_idx on public.operating_lessons(user_id,source_table,source_id) where source_table is not null;
alter table public.executive_snapshots add column if not exists founder_signals jsonb;
create index executive_snapshots_founder_date_idx on public.executive_snapshots(user_id,snapshot_date desc) where founder_signals is not null;
create unique index kpi_observations_date_idx on public.kpi_observations(user_id,kpi_id,observed_on);
create index waiting_items_followup_idx on public.waiting_items(user_id,followup_date) where status = 'waiting';
create index quality_incidents_founder_due_idx on public.quality_incidents(user_id,status,target_resolution_date);
create index operating_risks_review_idx on public.operating_risks(user_id,status,review_date);
create index operational_systems_renewal_idx on public.operational_systems(user_id,renewal_date);
create index operating_commitments_due_idx on public.operating_commitments(user_id,status,due_date);
create index operational_dependencies_source_idx on public.operational_dependencies(user_id,source_type,source_id);
create index operational_dependencies_target_idx on public.operational_dependencies(user_id,dependency_type,dependency_id);
alter table public.decisions drop constraint if exists decisions_status_check;
alter table public.decisions add constraint decisions_status_check check(status in ('active','review_due','superseded','reversed','archived','proposed','under_review','decided','implemented','validated'));

-- Invoker guards enforce same-owner references even through direct PostgREST writes.
create function public.founder_owner_guard() returns trigger language plpgsql set search_path = public as $$
declare refs jsonb; pair record; target uuid; owned boolean; row_data jsonb := to_jsonb(new); mapped text;
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then raise exception 'Owner cannot be changed' using errcode='23514'; end if;
  refs := case tg_table_name
    when 'quality_incidents' then '{"company_id":"companies","project_id":"projects","corrective_task_id":"tasks","system_id":"operational_systems"}'::jsonb
    when 'operating_risks' then '{"company_id":"companies","project_id":"projects","issue_id":"quality_incidents","decision_id":"decisions"}'::jsonb
    when 'companies' then '{"primary_project_id":"projects"}'::jsonb
    when 'operational_systems' then '{"company_id":"companies","subscription_id":"subscriptions"}'::jsonb
    when 'system_access_records' then '{"system_id":"operational_systems","person_id":"team_people"}'::jsonb
    when 'kpi_definitions' then '{"company_id":"companies"}'::jsonb
    when 'kpi_observations' then '{"kpi_id":"kpi_definitions"}'::jsonb
    when 'operating_relationships' then '{"company_id":"companies","client_id":"clients","supplier_id":"supplier_records","person_id":"team_people"}'::jsonb
    when 'operating_commitments' then '{"company_id":"companies","project_id":"projects","task_id":"tasks","waiting_id":"waiting_items","relationship_id":"operating_relationships"}'::jsonb
    when 'growth_experiments' then '{"company_id":"companies","project_id":"projects","decision_id":"decisions"}'::jsonb
    when 'asset_metadata' then '{"attachment_id":"attachments","content_id":"content_items","company_id":"companies","project_id":"projects","parent_asset_id":"asset_metadata"}'::jsonb
    when 'decisions' then '{"company_id":"companies","project_id":"projects","client_id":"clients"}'::jsonb
    when 'waiting_items' then '{"company_id":"companies","project_id":"projects","client_id":"clients","task_id":"tasks"}'::jsonb
    else '{}'::jsonb end;
  for pair in select * from jsonb_each_text(refs) loop
    target := nullif(row_data->>pair.key,'')::uuid;
    if target is not null then
      execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',pair.value) into owned using target,new.user_id;
      if not owned then raise exception 'Referenced record must belong to the same owner' using errcode='23514'; end if;
    end if;
  end loop;
  if tg_table_name = 'operational_dependencies' then
    for pair in select * from jsonb_each_text(jsonb_build_object('source',row_data->>'source_type','dependency',row_data->>'dependency_type')) loop
      mapped := ('{"task":"tasks","project":"projects","issue":"quality_incidents","decision":"decisions","person":"team_people","business":"companies","system":"operational_systems","obligation":"financial_obligations","commitment":"operating_commitments","sop":"operational_sops","process":"process_templates","run":"process_runs","client":"clients","opportunity":"opportunities","supplier":"supplier_records","product":"product_catalog_refs","campaign":"campaigns","calendar_event":"calendar_events","integration":"integrations","tool_system":"operational_systems","approval":"action_proposals","strategic_milestone":"strategic_milestones"}'::jsonb)->>pair.value;
      target := nullif(row_data->>(pair.key||'_id'),'')::uuid;
      if mapped is not null and target is not null then
        execute format('select exists(select 1 from public.%I where id=$1 and user_id=$2)',mapped) into owned using target,new.user_id;
        if not owned then raise exception 'Dependency endpoint must belong to owner' using errcode='23514'; end if;
      end if;
    end loop;
    if new.source_type=new.dependency_type and new.source_id=new.dependency_id then raise exception 'Self dependency is not allowed' using errcode='23514'; end if;
  end if;
  if tg_table_name='kpi_observations' then
    if not exists(select 1 from public.kpi_definitions where id=new.kpi_id and user_id=new.user_id and source='manual') then raise exception 'Transactional KPIs cannot have manual observations' using errcode='23514'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger founder_owner_guard before insert or update on public.quality_incidents for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.operating_risks for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.operational_dependencies for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.companies for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.operational_systems for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.system_access_records for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.kpi_definitions for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.kpi_observations for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.personal_balance_entries for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.operating_relationships for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.operating_commitments for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.growth_experiments for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.trips for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.personal_documents for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.asset_metadata for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.training_plans for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.training_observations for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.decisions for each row execute function public.founder_owner_guard();
create trigger founder_owner_guard before insert or update on public.waiting_items for each row execute function public.founder_owner_guard();

-- Reuse existing activity log. No credential or free-text payload is copied into audit metadata.
create function public.founder_audit_change() returns trigger language plpgsql set search_path = public as $$
declare r jsonb; before_row jsonb;
begin
  if tg_op='DELETE' then r:=to_jsonb(old); else r:=to_jsonb(new); end if;
  if tg_op='UPDATE' then before_row:=to_jsonb(old); end if;
  insert into public.activity_log(user_id,action,entity_type,entity_id,metadata,actor)
  values((r->>'user_id')::uuid,lower(tg_op),tg_table_name,(r->>'id')::uuid,
    jsonb_build_object('founder_os',true,'previous_status',before_row->>'status','status',r->>'status','previous_criticality',before_row->>'criticality','criticality',r->>'criticality','previous_access_level',before_row->>'access_level','access_level',r->>'access_level'), 'user');
  return coalesce(new,old);
end $$;
create trigger founder_audit_change after insert or update or delete on public.quality_incidents for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.operating_risks for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.operational_dependencies for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.companies for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.operational_systems for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.system_access_records for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.kpi_definitions for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.kpi_observations for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.personal_balance_entries for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.operating_relationships for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.operating_commitments for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.growth_experiments for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.trips for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.personal_documents for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.asset_metadata for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.training_plans for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.training_observations for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.decisions for each row execute function public.founder_audit_change();
create trigger founder_audit_change after insert or update or delete on public.waiting_items for each row execute function public.founder_audit_change();

-- Lessons are proposed with traceable source references; never auto-accepted.
create function public.founder_propose_lesson() returns trigger language plpgsql set search_path = public as $$
declare lesson_text text; label text; lesson_id uuid;
begin
  if tg_table_name='decisions' then lesson_text:=new.lesson_learned; label:=new.title;
  elsif tg_table_name='quality_incidents' then
    if new.status not in ('resolved','closed','archived') then return new; end if;
    lesson_text:=new.preventive_action; label:=new.title;
  else
    if new.status <> 'completed' then return new; end if;
    lesson_text:=new.lesson; label:=new.name;
  end if;
  if nullif(trim(lesson_text),'') is null then return new; end if;
  insert into public.operating_lessons(user_id,title,statement,why_proposed,domain,status,confidence_state,source_table,source_id)
  values(new.user_id,label,lesson_text,'Recorded outcome review; review before applying to other situations.','operations','proposed','weak',tg_table_name,new.id)
  on conflict(user_id,source_table,source_id) where source_table is not null do nothing returning id into lesson_id;
  if lesson_id is not null then
    insert into public.lesson_evidence_links(lesson_id,user_id,source_table,source_id,source_quality,description)
    values(lesson_id,new.user_id,tg_table_name,new.id::text,'user_reported','Lesson recorded in the source outcome review.');
  end if;
  return new;
end $$;
create trigger founder_propose_lesson after insert or update on public.decisions for each row execute function public.founder_propose_lesson();
create trigger founder_propose_lesson after insert or update on public.quality_incidents for each row execute function public.founder_propose_lesson();
create trigger founder_propose_lesson after insert or update on public.growth_experiments for each row execute function public.founder_propose_lesson();
alter table public.content_items add column if not exists audience text;
alter table public.content_items add column if not exists impressions bigint check(impressions >= 0);
alter table public.content_items add column if not exists clicks bigint check(clicks >= 0);
alter table public.content_items add column if not exists leads bigint check(leads >= 0);
alter table public.content_items add column if not exists conversions bigint check(conversions >= 0);
alter table public.content_items add column if not exists attributed_revenue numeric check(attributed_revenue >= 0);
alter table public.content_items add column if not exists production_cost numeric check(production_cost >= 0);
alter table public.content_items add column if not exists metric_currency text default 'MAD' check(metric_currency ~ '^[A-Z]{3}$');
alter table public.content_items add column if not exists learning text;
alter table public.fitness_activities add column if not exists perceived_exertion integer check(perceived_exertion between 1 and 10);
alter table public.focus_sessions add column if not exists category text check(category in ('deep_work','meetings','admin','engineering','operations','customer','marketing','finance','travel','fitness','reactive'));
create table public.personal_balance_history (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 entry_id uuid not null references public.personal_balance_entries(id), valued_on date not null,
 kind text not null check(kind in ('asset','liability')), amount numeric not null check(amount >= 0), currency text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,entry_id,valued_on)
);
alter table public.personal_balance_history enable row level security;
grant select on public.personal_balance_history to authenticated;
create policy personal_balance_history_owner_read on public.personal_balance_history for select to authenticated using ((select auth.uid())=user_id);
-- Invoker trigger writes owner-scoped history in the same transaction.
grant insert,update on public.personal_balance_history to authenticated;
create policy personal_balance_history_owner_write on public.personal_balance_history for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.personal_balance_entries e where e.id=entry_id and e.user_id=(select auth.uid())));
create policy personal_balance_history_owner_update on public.personal_balance_history for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from public.personal_balance_entries e where e.id=entry_id and e.user_id=(select auth.uid())));
create index personal_balance_history_owner_date_idx on public.personal_balance_history(user_id,valued_on desc);
create function public.founder_wealth_history() returns trigger language plpgsql set search_path=public as $$
begin
 insert into public.personal_balance_history(user_id,entry_id,valued_on,kind,amount,currency) values(new.user_id,new.id,new.valued_on,new.kind,new.amount,new.currency)
 on conflict(user_id,entry_id,valued_on) do update set amount=excluded.amount,kind=excluded.kind,currency=excluded.currency,updated_at=now();
 return new;
end $$;
create trigger founder_wealth_history after insert or update on public.personal_balance_entries for each row execute function public.founder_wealth_history();

-- Source capture conversion is atomic with record creation.
alter table public.quality_incidents add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index quality_incidents_capture_idx on public.quality_incidents(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.operating_risks add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index operating_risks_capture_idx on public.operating_risks(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.operational_dependencies add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index operational_dependencies_capture_idx on public.operational_dependencies(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.companies add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index companies_capture_idx on public.companies(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.operational_systems add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index operational_systems_capture_idx on public.operational_systems(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.system_access_records add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index system_access_records_capture_idx on public.system_access_records(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.kpi_definitions add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index kpi_definitions_capture_idx on public.kpi_definitions(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.kpi_observations add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index kpi_observations_capture_idx on public.kpi_observations(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.personal_balance_entries add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index personal_balance_entries_capture_idx on public.personal_balance_entries(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.operating_relationships add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index operating_relationships_capture_idx on public.operating_relationships(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.operating_commitments add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index operating_commitments_capture_idx on public.operating_commitments(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.growth_experiments add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index growth_experiments_capture_idx on public.growth_experiments(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.trips add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index trips_capture_idx on public.trips(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.personal_documents add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index personal_documents_capture_idx on public.personal_documents(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.asset_metadata add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index asset_metadata_capture_idx on public.asset_metadata(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.training_plans add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index training_plans_capture_idx on public.training_plans(user_id,source_inbox_id) where source_inbox_id is not null;
alter table public.training_observations add column if not exists source_inbox_id uuid references public.inbox_items(id);
create unique index training_observations_capture_idx on public.training_observations(user_id,source_inbox_id) where source_inbox_id is not null;
create function public.founder_capture_conversion() returns trigger language plpgsql set search_path=public as $$
declare capture_status text;
begin
 if new.source_inbox_id is null then return new; end if;
 if tg_op='UPDATE' and old.source_inbox_id is not distinct from new.source_inbox_id then return new; end if;
 select status into capture_status from public.inbox_items where id=new.source_inbox_id and user_id=new.user_id and deleted_at is null for update;
 if capture_status is distinct from 'unprocessed' then raise exception 'Capture is unavailable or already processed' using errcode='23514'; end if;
 update public.inbox_items set status='processed', target_type=tg_table_name, target_id=new.id where id=new.source_inbox_id and user_id=new.user_id;
 return new;
end $$;
create trigger founder_capture_conversion before insert or update on public.quality_incidents for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.operating_risks for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.operational_dependencies for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.companies for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.operational_systems for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.system_access_records for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.kpi_definitions for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.kpi_observations for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.personal_balance_entries for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.operating_relationships for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.operating_commitments for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.growth_experiments for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.trips for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.personal_documents for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.asset_metadata for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.training_plans for each row execute function public.founder_capture_conversion();
create trigger founder_capture_conversion before insert or update on public.training_observations for each row execute function public.founder_capture_conversion();
-- Transactional KPI values are database aggregations, never manually copied totals.
create index if not exists commerce_orders_founder_metric_idx on public.commerce_orders(user_id,company_id,created_at);
create function public.founder_kpi_values(as_of date default current_date)
returns table(id uuid,company_id uuid,name text,unit text,direction text,target numeric,warning_threshold numeric,critical_threshold numeric,source text,frequency text,current_value numeric,previous_value numeric,observed_on date,period_start date)
language sql stable security invoker set search_path=public as $$
 with defs as (
  select k.*, case k.frequency when 'monthly' then date_trunc('month',as_of)::date when 'weekly' then date_trunc('week',as_of)::date else as_of end as starts
  from public.kpi_definitions k where k.user_id=auth.uid() and k.active=true
 ), periods as (
  select d.*, case frequency when 'monthly' then (starts-interval '1 month')::date when 'weekly' then starts-7 else starts-1 end as previous_start from defs d
 )
 select k.id,k.company_id,k.name,k.unit,k.direction,k.target,k.warning_threshold,k.critical_threshold,k.source,k.frequency,
 case when k.source='manual' then (select o.value from public.kpi_observations o where o.user_id=auth.uid() and o.kpi_id=k.id and o.observed_on between k.starts and as_of order by o.observed_on desc limit 1)
 when k.company_id is null then null
 when k.source='commerce_orders' then (select count(*)::numeric from public.commerce_orders o where o.user_id=auth.uid() and o.company_id=k.company_id and o.created_at >= k.starts::timestamp at time zone 'UTC' and o.created_at < (as_of+1)::timestamp at time zone 'UTC' and o.status not in ('cancelled','canceled','refunded'))
 when k.source='commerce_revenue' then (select coalesce(sum(o.total_amount),0) from public.commerce_orders o where o.user_id=auth.uid() and o.company_id=k.company_id and o.currency=k.unit and o.created_at >= k.starts::timestamp at time zone 'UTC' and o.created_at < (as_of+1)::timestamp at time zone 'UTC' and o.status not in ('cancelled','canceled','refunded')) end,
 case when k.source='manual' then (select o.value from public.kpi_observations o where o.user_id=auth.uid() and o.kpi_id=k.id and o.observed_on >= k.previous_start and o.observed_on < k.starts order by o.observed_on desc limit 1)
 when k.company_id is null then null
 when k.source='commerce_orders' then (select count(*)::numeric from public.commerce_orders o where o.user_id=auth.uid() and o.company_id=k.company_id and o.created_at >= k.previous_start::timestamp at time zone 'UTC' and o.created_at < k.starts::timestamp at time zone 'UTC' and o.status not in ('cancelled','canceled','refunded'))
 when k.source='commerce_revenue' then (select coalesce(sum(o.total_amount),0) from public.commerce_orders o where o.user_id=auth.uid() and o.company_id=k.company_id and o.currency=k.unit and o.created_at >= k.previous_start::timestamp at time zone 'UTC' and o.created_at < k.starts::timestamp at time zone 'UTC' and o.status not in ('cancelled','canceled','refunded')) end,
 (select max(o.observed_on) from public.kpi_observations o where o.user_id=auth.uid() and o.kpi_id=k.id and o.observed_on <= as_of),k.starts
 from periods k;
$$;
revoke all on function public.founder_kpi_values(date) from public;
grant execute on function public.founder_kpi_values(date) to authenticated;

-- A single owner-scoped search call complements the existing workspace search.
create function public.search_founder_records(search_query text, result_limit integer default 12)
returns table(entity_type text,entity_id uuid,title text,snippet text)
language sql stable security invoker set search_path=public as $$
 select r.entity_type,r.entity_id,r.title,r.snippet from (
select 'founder_risk-register'::text as entity_type,id as entity_id,title::text as title,'risk-register'::text as snippet,updated_at from public.operating_risks where user_id=auth.uid() and position(lower(trim(search_query)) in lower(title))>0
 union all
select 'founder_relationships'::text as entity_type,id as entity_id,name::text as title,'relationships'::text as snippet,updated_at from public.operating_relationships where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_commitments'::text as entity_type,id as entity_id,title::text as title,'commitments'::text as snippet,updated_at from public.operating_commitments where user_id=auth.uid() and position(lower(trim(search_query)) in lower(title))>0
 union all
select 'founder_kpis'::text as entity_type,id as entity_id,name::text as title,'kpis'::text as snippet,updated_at from public.kpi_definitions where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_wealth'::text as entity_type,id as entity_id,name::text as title,'wealth'::text as snippet,updated_at from public.personal_balance_entries where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_assets'::text as entity_type,id as entity_id,name::text as title,'assets'::text as snippet,updated_at from public.asset_metadata where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_training-plans'::text as entity_type,id as entity_id,name::text as title,'training-plans'::text as snippet,updated_at from public.training_plans where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 union all
select 'founder_businesses'::text as entity_type,id as entity_id,name::text as title,'businesses'::text as snippet,updated_at from public.companies where user_id=auth.uid() and position(lower(trim(search_query)) in lower(name))>0
 ) r where length(trim(search_query)) between 2 and 240 order by r.updated_at desc,r.entity_id limit least(greatest(result_limit,1),30);
$$;
revoke all on function public.search_founder_records(text,integer) from public;
grant execute on function public.search_founder_records(text,integer) to authenticated;

create unique index founder_notification_condition_once on public.notifications(user_id,dedupe_key) where dedupe_key like 'founder:%' and resolved_at is null;

commit;
