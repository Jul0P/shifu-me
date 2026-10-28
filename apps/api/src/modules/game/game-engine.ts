import { GAME_CONFIG, type Move } from '@shifu/shared';

export type RoundOutcome = 'PLAYER_1' | 'PLAYER_2' | 'TIE' | 'BOTH_AFK';

const winsAgainst: Record<Move, Move> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

// Détermine le résultat d'une manche, y compris les égalités et les coups absents.
export function resolveMoves(player1: Move | null, player2: Move | null): RoundOutcome {
  if (!player1 && !player2) {
    return 'BOTH_AFK';
  }

  if (!player1) {
    return 'PLAYER_2';
  }

  if (!player2) {
    return 'PLAYER_1';
  }

  if (player1 === player2) {
    return 'TIE';
  }

  return winsAgainst[player1] === player2 ? 'PLAYER_1' : 'PLAYER_2';
}

// Calcule les nouveaux Elo du gagnant et du perdant sans descendre sous le minimum.
export function updatedElo(winnerElo: number, loserElo: number) {
  return {
    winner: winnerElo + GAME_CONFIG.ELO_WIN,
    loser: Math.max(GAME_CONFIG.MIN_ELO, loserElo - GAME_CONFIG.ELO_LOSS),
  };
}

// Indique si la série de doubles absences atteint le seuil d'annulation de la partie.
export function shouldCancelAfterBothAfk(consecutiveBothAfk: number) {
  return consecutiveBothAfk >= GAME_CONFIG.MAX_CONSECUTIVE_BOTH_AFK;
}
