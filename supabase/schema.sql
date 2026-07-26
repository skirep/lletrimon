-- Lletrix Supabase schema (full reset)
-- Run this in Supabase SQL Editor after dropping previous tables.

begin;

-- Drop old objects (safe order)
drop table if exists public.battle_challenges cascade;
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

-- Asynchronous multiplayer Pokémon battles
create table public.battle_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_profile_id text not null references public.profiles(id) on delete cascade,
  opponent_profile_id text not null references public.profiles(id) on delete cascade,
  team_size integer not null check (team_size in (1, 3)),
  challenger_team jsonb not null,
  opponent_team jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'completed')),
  result jsonb,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  responded_at bigint,
  simulated_at bigint,
  check (challenger_profile_id <> opponent_profile_id),
  check (jsonb_typeof(challenger_team) = 'array' and jsonb_array_length(challenger_team) = team_size),
  check (opponent_team is null or (jsonb_typeof(opponent_team) = 'array' and jsonb_array_length(opponent_team) = team_size))
);

create index battle_challenges_challenger_idx on public.battle_challenges(challenger_profile_id, created_at desc);
create index battle_challenges_opponent_idx on public.battle_challenges(opponent_profile_id, created_at desc);

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
alter table public.battle_challenges enable row level security;
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

-- Battle participants can see their shared challenge. Creation is limited to
-- the challenger; state transitions are performed by the validated RPCs below.
create policy battle_challenges_select_participant on public.battle_challenges
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.id in (battle_challenges.challenger_profile_id, battle_challenges.opponent_profile_id)
    )
  );

create policy battle_challenges_insert_challenger on public.battle_challenges
  for insert to authenticated
  with check (
    status = 'pending'
    and opponent_team is null
    and result is null
    and exists (
      select 1 from public.profiles p
      where p.id = battle_challenges.challenger_profile_id
        and p.user_id = auth.uid()
    )
    and exists (select 1 from public.rankings r where r.profile_id = battle_challenges.opponent_profile_id)
  );

create or replace function public.respond_to_battle_challenge(
  challenge_id uuid,
  accept_challenge boolean,
  selected_team jsonb default null
)
returns public.battle_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  challenge public.battle_challenges;
begin
  select * into challenge from public.battle_challenges where id = challenge_id for update;
  if challenge.id is null then raise exception 'Repte no trobat'; end if;
  if challenge.status <> 'pending' then raise exception 'Aquest repte ja ha estat respost'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = challenge.opponent_profile_id and p.user_id = auth.uid()
  ) then raise exception 'No pots respondre aquest repte'; end if;

  if accept_challenge and (
    selected_team is null
    or jsonb_typeof(selected_team) <> 'array'
    or jsonb_array_length(selected_team) <> challenge.team_size
  ) then raise exception 'Cal seleccionar l’equip complet'; end if;

  update public.battle_challenges
  set status = case when accept_challenge then 'accepted' else 'declined' end,
      opponent_team = case when accept_challenge then selected_team else null end,
      responded_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
  where id = challenge_id
  returning * into challenge;
  return challenge;
end;
$$;

create or replace function public.open_battle_challenge(challenge_id uuid)
returns public.battle_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  challenge public.battle_challenges;
  challenger_power integer;
  opponent_power integer;
  variance integer;
  challenger_score integer;
  opponent_score integer;
  winner_id text;
begin
  select * into challenge from public.battle_challenges where id = challenge_id for update;
  if challenge.id is null then raise exception 'Repte no trobat'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.id in (challenge.challenger_profile_id, challenge.opponent_profile_id)
  ) then raise exception 'No pots veure aquest repte'; end if;
  if challenge.status = 'pending' then raise exception 'El rival encara no ha acceptat el repte'; end if;
  if challenge.status = 'declined' then return challenge; end if;

  if challenge.result is null then
    select coalesce(sum((pokemon->>'power')::integer), 0) into challenger_power
    from jsonb_array_elements(challenge.challenger_team) pokemon;
    select coalesce(sum((pokemon->>'power')::integer), 0) into opponent_power
    from jsonb_array_elements(challenge.opponent_team) pokemon;

    variance := (('x' || substr(md5(challenge.id::text), 1, 8))::bit(32)::bigint % 21)::integer - 10;
    challenger_score := greatest(1, challenger_power + variance);
    opponent_score := greatest(1, opponent_power - variance);
    winner_id := case when challenger_score >= opponent_score then challenge.challenger_profile_id else challenge.opponent_profile_id end;

    update public.battle_challenges
    set status = 'completed',
        result = jsonb_build_object(
          'winnerProfileId', winner_id,
          'challengerScore', challenger_score,
          'opponentScore', opponent_score,
          'summary', case
            when abs(challenger_score - opponent_score) <= 10 then 'Una lluita molt igualada decidida a l’últim atac.'
            else 'L’equip guanyador s’ha imposat amb una estratègia contundent.'
          end
        ),
        simulated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
    where id = challenge_id
    returning * into challenge;
  end if;

  return challenge;
end;
$$;

revoke all on function public.respond_to_battle_challenge(uuid, boolean, jsonb) from public;
revoke all on function public.open_battle_challenge(uuid) from public;
grant execute on function public.respond_to_battle_challenge(uuid, boolean, jsonb) to authenticated;
grant execute on function public.open_battle_challenge(uuid) to authenticated;

commit;
