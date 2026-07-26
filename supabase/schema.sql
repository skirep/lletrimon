-- Lletrix Supabase schema (full reset)
-- Run this in Supabase SQL Editor after dropping previous tables.

begin;

-- Drop old objects (safe order)
drop table if exists public.profile_settings cascade;
drop table if exists public.profile_sessions cascade;
drop table if exists public.profile_badges cascade;
drop table if exists public.daily_goals cascade;
drop table if exists public.streaks cascade;
drop table if exists public.profile_stats cascade;
drop table if exists public.rankings cascade;
drop table if exists public.profiles cascade;

-- Profiles
create table public.profiles (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  avatar text not null,
  school text,
  location text,
  created_at bigint not null,
  updated_at bigint not null
);

create index profiles_user_id_idx on public.profiles(user_id);
create index profiles_name_idx on public.profiles(name);

-- Aggregated profile stats
create table public.profile_stats (
  profile_id text primary key references public.profiles(id) on delete cascade,
  total_exercises integer not null default 0,
  total_correct integer not null default 0,
  total_attempts integer not null default 0,
  total_time_ms bigint not null default 0,
  consecutive_days integer not null default 0,
  last_session_date bigint not null default 0,
  experience integer not null default 0,
  level integer not null default 1,
  error_frequency jsonb not null default '{}'::jsonb
);

-- Session history
create table public.profile_sessions (
  id text primary key,
  profile_id text not null references public.profiles(id) on delete cascade,
  set_id text not null,
  type text not null check (type in ('sounds', 'syllables', 'words', 'pseudowords', 'sentences')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  attempts jsonb not null default '[]'::jsonb,
  started_at bigint not null,
  completed_at bigint,
  score integer not null check (score >= 0 and score <= 100),
  total_items integer not null default 0,
  correct_items integer not null default 0,
  average_time_ms numeric not null default 0
);

create index profile_sessions_profile_id_idx on public.profile_sessions(profile_id);
create index profile_sessions_profile_completed_idx on public.profile_sessions(profile_id, completed_at desc);
create index profile_sessions_profile_type_idx on public.profile_sessions(profile_id, type);

-- Badges unlocked per profile
create table public.profile_badges (
  profile_id text not null references public.profiles(id) on delete cascade,
  badge_id text not null,
  earned_at bigint not null,
  primary key (profile_id, badge_id)
);

create index profile_badges_profile_id_idx on public.profile_badges(profile_id);

-- Daily goals
create table public.daily_goals (
  profile_id text not null references public.profiles(id) on delete cascade,
  date date not null,
  target_exercises integer not null default 5,
  completed_exercises integer not null default 0,
  completed boolean not null default false,
  primary key (profile_id, date)
);

create index daily_goals_profile_id_idx on public.daily_goals(profile_id);

-- Streaks
create table public.streaks (
  profile_id text primary key references public.profiles(id) on delete cascade,
  current integer not null default 0,
  longest integer not null default 0,
  last_date date
);

-- Public ranking cache
create table public.rankings (
  profile_id text primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  school text,
  location text,
  level integer not null default 1,
  experience integer not null default 0,
  total_exercises integer not null default 0,
  pokemon_ids integer[] not null default '{}',
  updated_at bigint not null default 0
);

create index rankings_experience_idx on public.rankings(experience desc);

-- Per-profile app settings
create table public.profile_settings (
  profile_id text primary key references public.profiles(id) on delete cascade,
  settings_version integer not null default 1,
  settings_data jsonb not null default '{}'::jsonb,
  speed integer not null default 2,
  exercise_speeds jsonb not null default '{"sounds":2,"syllables":2,"words":2,"pseudowords":2,"sentences":2}'::jsonb,
  uppercase_text boolean not null default false,
  font_size text not null default 'large' check (font_size in ('small', 'medium', 'large', 'xlarge')),
  font_family text not null default 'standard' check (font_family in ('standard', 'dyslexia')),
  color_scheme text not null default 'default' check (color_scheme in ('default', 'high-contrast', 'warm', 'cool')),
  skin text not null default 'original' check (skin in ('original', 'pokemon', 'pikachu-ash', 'team-rocket')),
  dyslexia_mode boolean not null default false,
  time_between_words integer not null default 0,
  fullscreen boolean not null default false
);

-- RLS
alter table public.profiles enable row level security;
alter table public.profile_stats enable row level security;
alter table public.profile_sessions enable row level security;
alter table public.profile_badges enable row level security;
alter table public.daily_goals enable row level security;
alter table public.streaks enable row level security;
alter table public.rankings enable row level security;
alter table public.profile_settings enable row level security;

-- profiles: only owner
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = user_id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (auth.uid() = user_id);

-- helper condition used in child tables
-- "row belongs to a profile owned by current user"

create policy profile_stats_all_own on public.profile_stats
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_stats.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_stats.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy profile_sessions_all_own on public.profile_sessions
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_sessions.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_sessions.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy profile_badges_all_own on public.profile_badges
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_badges.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_badges.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy daily_goals_all_own on public.daily_goals
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = daily_goals.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = daily_goals.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy streaks_all_own on public.streaks
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = streaks.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = streaks.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy profile_settings_all_own on public.profile_settings
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_settings.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_settings.profile_id
        and p.user_id = auth.uid()
    )
  );

-- Rankings are public to authenticated users, but writable only by owner profile.
create policy rankings_select_all on public.rankings
  for select to authenticated
  using (true);

create policy rankings_write_own on public.rankings
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = rankings.profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = rankings.profile_id
        and p.user_id = auth.uid()
    )
  );

commit;
