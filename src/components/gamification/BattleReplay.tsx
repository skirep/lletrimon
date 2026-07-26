import { useEffect, useState } from 'react';
import type { BattleChallenge, BattlePokemon } from '../../models';
import styles from './BattleReplay.module.css';

interface BattleReplayProps {
  challenge: BattleChallenge;
  autoPlay?: boolean;
}

const ATTACKS = ['Atac ràpid', 'Cop de força', 'Moviment especial', 'Impacte final'];

function Fighter({ pokemon, side, attacking, hit }: {
  pokemon: BattlePokemon;
  side: 'left' | 'right';
  attacking: boolean;
  hit: boolean;
}) {
  return (
    <div className={`${styles.fighter} ${styles[side]} ${attacking ? styles.attacking : ''} ${hit ? styles.hit : ''}`}>
      {pokemon.imageUrl
        ? <img src={pokemon.imageUrl} alt={pokemon.name} />
        : <div className={styles.fallback}>?</div>}
      <strong>{pokemon.name}</strong>
      <span>Força {pokemon.power}</span>
    </div>
  );
}

export function BattleReplay({ challenge, autoPlay = false }: BattleReplayProps) {
  const [playing, setPlaying] = useState(autoPlay);
  const [turn, setTurn] = useState(0);
  const [finished, setFinished] = useState(false);
  const challengerTeam = [...challenge.challengerTeam].sort((left, right) => right.power - left.power);
  const opponentTeam = [...(challenge.opponentTeam ?? [])].sort((left, right) => right.power - left.power);
  const totalTurns = Math.max(4, challenge.teamSize * 4);
  const pairIndex = Math.min(challenge.teamSize - 1, Math.floor(turn / 4));
  const challenger = challengerTeam[pairIndex] ?? challengerTeam[0];
  const opponent = opponentTeam[pairIndex] ?? opponentTeam[0];
  const challengerAttacks = turn % 2 === 0;

  useEffect(() => {
    if (!playing) return;
    if (turn >= totalTurns) {
      setPlaying(false);
      setFinished(true);
      return;
    }

    const timer = window.setTimeout(() => setTurn((current) => current + 1), 760);
    return () => window.clearTimeout(timer);
  }, [playing, totalTurns, turn]);

  const play = () => {
    setTurn(0);
    setFinished(false);
    setPlaying(true);
  };

  if (!challenge.result || !challenger || !opponent) return null;

  return (
    <div className={styles.replay}>
      <div className={styles.stage} aria-live="polite">
        <div className={styles.trainerLabel}>{challenge.challengerName}</div>
        <div className={styles.trainerLabel}>{challenge.opponentName}</div>
        <Fighter pokemon={challenger} side="left" attacking={playing && challengerAttacks} hit={playing && !challengerAttacks} />
        <div className={styles.clash} aria-hidden="true">VS</div>
        <Fighter pokemon={opponent} side="right" attacking={playing && !challengerAttacks} hit={playing && challengerAttacks} />
        {playing && turn < totalTurns && (
          <div className={styles.attackLine} key={turn}>
            {(challengerAttacks ? challenger : opponent).name} usa {ATTACKS[turn % ATTACKS.length]}
          </div>
        )}
      </div>

      <div className={styles.timeline}>
        <div style={{ width: `${Math.min(100, (turn / totalTurns) * 100)}%` }} />
      </div>

      {(finished || !playing) && (
        <div className={styles.finalScore}>
          <span>{challenge.result.winnerProfileId === challenge.challengerProfileId ? challenge.challengerName : challenge.opponentName} guanya</span>
          <strong>{challenge.result.challengerScore} - {challenge.result.opponentScore}</strong>
        </div>
      )}

      <button type="button" className={styles.playButton} onClick={play} disabled={playing}>
        {playing ? 'Reproduint la lluita...' : finished ? '↻ Torna a reproduir-la' : '▶ Reprodueix la lluita'}
      </button>
    </div>
  );
}