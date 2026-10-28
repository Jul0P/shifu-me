import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Feedback } from '@/components/ui/feedback';
import { PageHeading } from '@/components/ui/page-heading';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/features/auth/auth-context';
import { leaderboardOptions } from './leaderboard-api';

export function LeaderboardPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const board = useQuery({ ...leaderboardOptions(page), placeholderData: keepPreviousData });

  return (
    <section className="space-y-5">
      <PageHeading>🏆 CLASSEMENT</PageHeading>
      <p className="text-sm font-bold">Chaque match compte. Qui prendra la première place ?</p>
      {board.isPending ? (
        <Feedback title="Le classement arrive…" loading />
      ) : board.isError ? (
        <Feedback
          title="Classement indisponible"
          error={board.error}
          onRetry={() => {
            void board.refetch();
          }}
        />
      ) : (
        <>
          <div className="arcade-card overflow-x-auto bg-white p-3 sm:p-5" aria-busy={board.isFetching}>
            <table className="w-full min-w-112 text-sm">
              <caption className="sr-only">Classement des joueurs par Elo décroissant</caption>
              <thead>
                <tr className="title border-b-2 border-black text-left text-xs">
                  <th scope="col" className="p-2">
                    #
                  </th>
                  <th scope="col" className="p-2">
                    JOUEUR
                  </th>
                  <th scope="col" className="p-2 text-right">
                    ELO
                  </th>
                  <th scope="col" className="p-2 text-right">
                    <abbr title="Victoires">V</abbr>
                  </th>
                  <th scope="col" className="p-2 text-right">
                    <abbr title="Défaites">D</abbr>
                  </th>
                  <th scope="col" className="p-2 text-right">
                    RATIO
                  </th>
                </tr>
              </thead>
              <tbody>
                {board.data.items.map((player) => (
                  <tr key={player.id} className={player.id === user?.id ? 'border-b border-black/15 bg-cyber font-bold' : 'border-b border-black/15 font-bold'}>
                    <td className="p-2">
                      {player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : player.rank}
                      <span className="sr-only">Rang {player.rank}</span>
                    </td>
                    <th scope="row" className="max-w-52 p-2 text-left">
                      <span className="mr-2" aria-hidden="true">
                        {player.avatar}
                      </span>
                      <span className="break-all">{player.username}</span>
                      {player.id === user?.id && <span className="ml-1 text-[10px]">(TOI)</span>}
                    </th>
                    <td className="p-2 text-right">{player.elo}</td>
                    <td className="p-2 text-right">{player.stats.wins}</td>
                    <td className="p-2 text-right">{player.stats.losses}</td>
                    <td className="p-2 text-right">{player.stats.wins + player.stats.losses ? `${Math.round(player.winRate)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!board.data.items.length && <p className="py-8 text-center text-sm font-bold">Aucun joueur pour le moment. À toi d’ouvrir le classement !</p>}
          </div>
          <p className="text-center text-xs font-bold">
            {board.data.total} joueur{board.data.total > 1 ? 's' : ''}
          </p>
          <Pagination page={page} pages={board.data.pages} busy={board.isFetching} onChange={setPage} />
        </>
      )}
    </section>
  );
}
