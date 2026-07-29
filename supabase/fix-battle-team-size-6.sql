-- Fix: allow team_size = 6 in battle_challenges.
-- Run this if the table was created before team size 6 was added.

begin;

alter table public.battle_challenges
  drop constraint if exists battle_challenges_team_size_check;
alter table public.battle_challenges
  add constraint battle_challenges_team_size_check check (team_size in (1, 3, 6));

commit;
