-- Incremental migration: asynchronous multiplayer Pokémon battles.
-- Safe to run on an existing Lletrimon database.

begin;

create table if not exists public.battle_challenges (
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

create index if not exists battle_challenges_challenger_idx on public.battle_challenges(challenger_profile_id, created_at desc);
create index if not exists battle_challenges_opponent_idx on public.battle_challenges(opponent_profile_id, created_at desc);

alter table public.battle_challenges enable row level security;

drop policy if exists battle_challenges_select_participant on public.battle_challenges;
create policy battle_challenges_select_participant on public.battle_challenges
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.id in (battle_challenges.challenger_profile_id, battle_challenges.opponent_profile_id)
    )
  );

drop policy if exists battle_challenges_insert_challenger on public.battle_challenges;
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