import { historyResponseSchema } from '@shifu/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Feedback } from '@/components/ui/feedback';
import { PageHeading } from '@/components/ui/page-heading';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/features/auth/auth-context';
import { apiRequest } from '@/lib/api-client';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export function HistoryPage() {
  const { user, token } = useAuth();
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['history', user?.id, page],
    queryFn: ({ signal }) => apiRequest(`/api/users/me/history?page=${page}&limit=10`, historyResponseSchema, { signal, token }),
    placeholderData: keepPreviousData,
  });

  return (
    <section className="space-y-5">
      <PageHeading>📜 MON HISTORIQUE</PageHeading>
      <p className="text-sm font-bold">Tes duels, tes résultats et ton évolution Elo.</p>
      {history.isPending ? (
        <Feedback title="On retrouve tes matchs…" loading />
      ) : history.isError ? (
        <Feedback
          title="Historique indisponible"
          error={history.error}
          onRetry={() => {
            void history.refetch();
          }}
        />
      ) : !history.data.items.length ? (
        <div className="arcade-card space-y-4 bg-white p-8 text-center">
          <div className="text-5xl" aria-hidden="true">
            📜
          </div>
          <h2 className="title text-xl">TOUT RESTE À JOUER.</h2>
          <p className="text-sm font-bold">Tes matchs terminés apparaîtront ici. Les parties annulées ne comptent pas.</p>
          <Button asChild>
            <Link to="/play">JOUER MON PREMIER MATCH</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-4" aria-busy={history.isFetching}>
            {history.data.items.map((match) => (
              <li key={match.id} className="arcade-card flex flex-wrap items-center gap-4 bg-white p-4 sm:p-5">
                <span className="text-4xl" aria-hidden="true">
                  {match.opponent.avatar}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="title break-all text-sm">VS {match.opponent.username}</h2>
                  <p className="mt-1 text-xs font-bold">
                    <time dateTime={match.finishedAt}>{dateFormat.format(new Date(match.finishedAt))}</time>
                    {match.roomCode && ' · SALLE PRIVÉE'}
                  </p>
                  <Link to="/game/$gameId" params={{ gameId: match.gameId }} className="mt-1 inline-flex min-h-8 items-center text-xs font-bold underline">
                    Voir les manches →
                  </Link>
                </div>
                <div className="text-center">
                  <p className="title text-xl">
                    {match.myScore} — {match.opponentScore}
                  </p>
                  <span className={`arcade-chip mt-1 inline-block px-2 py-1 text-xs font-bold ${match.won ? 'bg-mint' : 'bg-coral'}`}>
                    {match.won ? 'VICTOIRE' : 'DÉFAITE'} · {match.eloDelta > 0 ? '+' : ''}
                    {match.eloDelta} ELO
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={history.data.pages} busy={history.isFetching} onChange={setPage} />
        </>
      )}
    </section>
  );
}
