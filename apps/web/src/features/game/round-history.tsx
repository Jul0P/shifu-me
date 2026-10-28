import { type GameResponse, roundsResponseSchema } from '@shifu/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Feedback } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/features/auth/auth-context';
import { apiRequest } from '@/lib/api-client';
import { moveEmoji } from './game-api';

export function RoundHistory({ game }: { game: GameResponse }) {
  const { token, user } = useAuth();
  const [page, setPage] = useState(1);
  const rounds = useQuery({
    queryKey: ['rounds', user?.id, game.id, page, game.lastResult?.id],
    queryFn: ({ signal }) =>
      apiRequest(`/api/game/${game.id}/rounds?page=${page}&limit=10`, roundsResponseSchema, {
        signal,
        token,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      {rounds.isPending ? (
        <p role="status" className="text-sm font-bold">
          Chargement des manches…
        </p>
      ) : rounds.isError ? (
        <Feedback
          title="Manches indisponibles"
          error={rounds.error}
          onRetry={() => {
            void rounds.refetch();
          }}
        />
      ) : (
        <>
          {!rounds.data.items.length ? (
            <p className="text-sm font-bold">Les manches terminées apparaîtront ici.</p>
          ) : (
            <ol className="space-y-2">
              {rounds.data.items.map((round) => (
                <li key={round.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-black/20 py-2 text-sm font-bold">
                  <span>MANCHE {round.roundNumber}</span>
                  <span role="img" aria-label="Ton coup et le coup adverse">
                    {moveEmoji(game.side === 'PLAYER_1' ? round.player1Move : round.player2Move)} <span className="px-1 text-xs">VS</span> {moveEmoji(game.side === 'PLAYER_1' ? round.player2Move : round.player1Move)}
                  </span>
                  <span>{round.outcome === 'BOTH_AFK' ? 'DEUX ABSENTS' : round.outcome === 'TIE' ? 'ÉGALITÉ' : round.outcome === game.side ? 'GAGNÉE' : 'PERDUE'}</span>
                </li>
              ))}
            </ol>
          )}
          {rounds.data.pages > 1 && <Pagination page={page} pages={rounds.data.pages} busy={rounds.isFetching} onChange={setPage} />}
        </>
      )}
    </div>
  );
}
