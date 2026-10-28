import { GAME_CONFIG, type GameResponse, type PublicUser } from '@shifu/shared';

export const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
export const GAME_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
export const ROUND_ID = 'dddddddddddddddddddddddd';
export const TOKEN = 'session-fictive-reservee-aux-tests';

export const user: PublicUser = {
  id: USER_ID,
  username: 'JoueurTest',
  avatar: '🪨',
  elo: 100,
  stats: { wins: 0, losses: 0 },
};

// Chaque appel fournit des dates fraîches et un état indépendant pour éviter les tests couplés.
export function makeGame(overrides: Partial<GameResponse> = {}): GameResponse {
  const now = Date.now();
  return {
    id: GAME_ID,
    status: 'PLAYING',
    phase: 'CHOOSING',
    serverTime: new Date(now).toISOString(),
    roomCode: null,
    side: 'PLAYER_1',
    score: { me: 0, opponent: 0 },
    consecutiveBothAfk: 0,
    me: { ...user, submitted: false, connected: true, move: null },
    opponent: { id: 'cccccccccccccccccccccccc', username: 'Adversaire', avatar: '🐉', elo: 100, submitted: false, connected: true },
    round: {
      id: ROUND_ID,
      number: 1,
      startsAt: new Date(now).toISOString(),
      endsAt: new Date(now + GAME_CONFIG.ROUND_DURATION_MS).toISOString(),
    },
    lastResult: null,
    finish: null,
    ...overrides,
  };
}

export function completedGame(roomCode: string | null = null): GameResponse {
  return makeGame({
    status: 'COMPLETED',
    phase: 'FINISHED',
    roomCode,
    score: { me: 3, opponent: 1 },
    lastResult: { id: ROUND_ID, roundNumber: 4, player1Move: 'rock', player2Move: 'scissors', outcome: 'PLAYER_1', resolvedAt: new Date().toISOString() },
    finish: { winnerId: USER_ID, myDelta: 10, myElo: 110, opponentElo: 90, finishedAt: new Date().toISOString() },
  });
}
