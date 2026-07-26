-- Apply once to existing databases. Safe to run more than once.
alter table public.rankings
  add column if not exists pokemon_ids integer[] not null default '{}';