import { gameResponseSchema, type Move } from '@shifu/shared';
import { type ApiOptions, apiRequest } from '@/lib/api-client';

export async function requestGame(id: string, options: ApiOptions = {}) {
  const sentAt = performance.now();
  const game = await apiRequest(`/api/game/${id}${options.method === 'POST' ? '/action' : '/poll'}`, gameResponseSchema, options);
  const receivedAt = performance.now();

  return { game, receivedAt, serverAtReceipt: Date.parse(game.serverTime) + (receivedAt - sentAt) / 2 };
}

export type GameSnapshot = Awaited<ReturnType<typeof requestGame>>;

export function latestSnapshot(previous: GameSnapshot | undefined, next: GameSnapshot): GameSnapshot {
  return previous && Date.parse(previous.game.serverTime) > Date.parse(next.game.serverTime) ? previous : next;
}

export const MOVES: { value: Move; label: string; emoji: string }[] = [
  { value: 'rock', label: 'PIERRE', emoji: '✊' },
  { value: 'paper', label: 'FEUILLE', emoji: '✋' },
  { value: 'scissors', label: 'CISEAUX', emoji: '✌️' },
];

export function moveEmoji(move: Move | null) {
  return MOVES.find((item) => item.value === move)?.emoji ?? '💤';
}
