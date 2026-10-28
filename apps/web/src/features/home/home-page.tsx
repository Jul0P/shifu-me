import { GAME_CONFIG } from '@shifu/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Feedback } from '@/components/ui/feedback';
import { useAuth } from '@/features/auth/auth-context';
import { leaderboardOptions } from '@/features/leaderboard/leaderboard-api';
import { lobbyRequest } from '@/features/matchmaking/lobby-api';

function TopThree() {
  const board = useQuery(leaderboardOptions(1, 3));

  return (
    <section className="arcade-card space-y-4 bg-white p-5">
      <h2 className="title text-lg">🏆 TOP 3 MONDIAL</h2>
      {board.isPending ? (
        <p role="status" className="text-sm font-bold">
          Chargement du podium…
        </p>
      ) : board.isError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm font-bold">
            Le podium est momentanément indisponible.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void board.refetch();
            }}
          >
            RÉESSAYER
          </Button>
        </div>
      ) : board.data.items.length ? (
        <ol className="space-y-2">
          {board.data.items.map((player, index) => (
            <li key={player.id} className="flex items-center gap-3 rounded-lg border-2 border-black bg-yellow-50 p-3 font-bold">
              <span className="text-2xl" role="img" aria-label={`Place ${index + 1}`}>
                {['🥇', '🥈', '🥉'][index]}
              </span>
              <span className="text-2xl" aria-hidden="true">
                {player.avatar}
              </span>
              <span className="min-w-0 flex-1 truncate">{player.username}</span>
              <span className="title text-sm">
                {player.elo} <span className="text-[10px]">ELO</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm font-bold">Le podium attend ses premiers joueurs.</p>
      )}
      <Button asChild variant="outline" className="w-full">
        <Link to="/leaderboard">
          VOIR LE CLASSEMENT COMPLET <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}

function Landing() {
  return (
    <div className="space-y-5">
      <section className="arcade-card space-y-5 bg-white p-5 text-center sm:p-7">
        <h1 className="title text-3xl leading-[1.15] sm:text-[2.7rem]">
          LE CHIFOUMI
          <br />
          <span className="mt-2 inline-block bg-cyber px-2 py-1">ARBITRÉ PAR LE CHRONO</span>
        </h1>
        <p className="mx-auto max-w-lg text-sm font-bold sm:text-base">10 secondes par manche, BO5, horloge tenue côté serveur : plus de gestes décalés, plus de contestations, un score Elo qui reste.</p>
        <Button asChild size="lg" className="w-full py-4 text-lg sm:text-xl">
          <Link to="/register">⚔️ ENTRER DANS L’ARÈNE</Link>
        </Button>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: '⏱️',
            title: '10 SECONDES',
            text: 'Choisis une fois. Les coups restent cachés jusqu’à la fin du chrono.',
          },
          { icon: '🏅', title: 'BEST OF 5', text: 'Premier à 3 victoires. Égalité = manche rejouée.' },
          {
            icon: '📈',
            title: 'ELO',
            text: `Départ ${GAME_CONFIG.INITIAL_ELO}, ±${GAME_CONFIG.ELO_WIN} par match, plancher à 0.`,
          },
        ].map((rule) => (
          <section key={rule.title} className="arcade-card bg-white p-4 text-center">
            <div className="mb-2 text-3xl" aria-hidden="true">
              {rule.icon}
            </div>
            <h2 className="title text-sm">{rule.title}</h2>
            <p className="mt-2 text-xs font-bold">{rule.text}</p>
          </section>
        ))}
      </div>
      <TopThree />
    </div>
  );
}

function PlayerHub() {
  const { user, token } = useAuth();
  const lobby = useQuery({
    queryKey: ['lobby', user?.id],
    queryFn: ({ signal }) => lobbyRequest('/api/matchmaking/status', token, 'GET', signal),
    staleTime: 0,
  });

  if (!user) {
    return null;
  }

  const total = user.stats.wins + user.stats.losses;
  const state = lobby.data;

  return (
    <div className="space-y-5">
      <section className="arcade-card flex items-center gap-4 bg-white p-5">
        <span className="arcade-chip flex size-16 shrink-0 items-center justify-center bg-cyber text-4xl" aria-hidden="true">
          {user.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="title break-all text-xl sm:text-2xl">{user.username}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="arcade-chip bg-white px-2 py-1">ELO {user.elo}</span>
            <span className="arcade-chip bg-white px-2 py-1">
              {user.stats.wins} V — {user.stats.losses} D
            </span>
            <span className="arcade-chip bg-white px-2 py-1">RATIO {total ? `${Math.round((user.stats.wins / total) * 100)}%` : '—'}</span>
          </div>
        </div>
      </section>
      {lobby.isError && (
        <Feedback
          title="Recherche indisponible"
          error={lobby.error}
          onRetry={() => {
            void lobby.refetch();
          }}
        />
      )}
      {state?.status === 'matched' ? (
        <Button asChild size="lg" className="w-full py-6 text-xl">
          <Link to="/game/$gameId" params={{ gameId: state.gameId }}>
            ⚔️ REPRENDRE MA PARTIE
          </Link>
        </Button>
      ) : state?.status === 'waiting' ? (
        <Button asChild size="lg" className="w-full py-6">
          <Link to="/rooms">🎯 RETROUVER MA SALLE · {state.code}</Link>
        </Button>
      ) : (
        <Button asChild size="lg" className="w-full py-6 text-xl sm:text-2xl">
          <Link to="/play">⚔️ {state?.status === 'searching' ? 'REPRENDRE LA RECHERCHE' : 'JOUER UN MATCH'}</Link>
        </Button>
      )}
      <Button asChild variant="outline" className="w-full">
        <Link to="/rooms">🎯 DÉFIER UN AMI — code de salle</Link>
      </Button>
      <div className="grid grid-cols-2 gap-4">
        <Button asChild variant="outline" className="py-4">
          <Link to="/leaderboard">🏆 CLASSEMENT</Link>
        </Button>
        <Button asChild variant="outline" className="py-4">
          <Link to="/history">📜 HISTORIQUE</Link>
        </Button>
      </div>
    </div>
  );
}

export function HomePage() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <Feedback title="On retrouve ton profil…" loading />;
  }

  if (auth.error) {
    return <Feedback title="Profil indisponible" error={auth.error} onRetry={auth.retry} />;
  }

  return auth.user ? <PlayerHub /> : <Landing />;
}
