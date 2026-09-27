-- Support step-count and nutrition-day goals alongside workout targets.
alter table public.fitness_targets drop constraint if exists fitness_targets_target_type_check;
alter table public.fitness_targets add constraint fitness_targets_target_type_check check (target_type in ('sessions','distance_km','duration_minutes','steps','days'));
