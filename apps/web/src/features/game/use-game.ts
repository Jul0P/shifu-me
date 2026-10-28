import { GAME_CONFIG, type Move } from '@shifu/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/api-client';
import { type GameSnapshot, latestSnapshot, requestGame } from './game-api';

export function useGame(gameId: string) {
  const { token, user } = useAuth();
  const client = useQueryClient();
  const key = ['game', user?.id, gameId];
  const [clock, setClock] = useState(() => performance.now());
  const finalized = useRef<string | null>(null);
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const next = await requestGame(gameId, { token, signal });
      return latestSnapshot(client.getQueryData<GameSnapshot>(key), next);
    },
    staleTime: 0,
    refetchInterval: (state) => {
      if (state.state.data?.game.status !== 'PLAYING' && state.state.data) {
        return false;
      }
      if (state.state.error instanceof ApiError && [401, 403, 404, 422].includes(state.state.error.status)) {
        return false;
      }
      return Math.min(GAME_CONFIG.GAME_POLL_MS * 2 ** state.state.fetchFailureCount, 10_000);
    },
  });
  const action = useMutation({
    mutationFn: ({ roundId, move }: { roundId: string; move: Move }) => requestGame(gameId, { method: 'POST', token, body: JSON.stringify({ roundId, move }) }),
    onSuccess: (next) => client.setQueryData<GameSnapshot>(key, (previous) => latestSnapshot(previous, next)),
    onError: () => {
      void client.invalidateQueries({ queryKey: key });
    },
  });
  const game = query.data?.game;

  useEffect(() => {
    if (game?.status !== 'PLAYING') {
      return;
    }
    const timer = window.setInterval(() => setClock(performance.now()), 100);
    return () => window.clearInterval(timer);
  }, [game?.status]);

  useEffect(() => {
    if (game?.round.id) {
      action.reset();
    }
  }, [game?.round.id, action.reset]);

  useEffect(() => {
    if (game && game.status !== 'PLAYING' && finalized.current !== game.id) {
      finalized.current = game.id;
      for (const name of ['profile', 'leaderboard', 'history', 'lobby']) {
        void client.invalidateQueries({ queryKey: [name] });
      }
    }
  }, [game, client]);

  const serverNow = query.data ? query.data.serverAtReceipt + Math.max(0, clock - query.data.receivedAt) : 0;
  const remaining = game ? Math.max(0, Date.parse(game.round.endsAt) - serverNow) : 0;
  const startingIn = game ? Math.max(0, Date.parse(game.round.startsAt) - serverNow) : 0;

  return { query, action, game, remaining, startingIn };
}
