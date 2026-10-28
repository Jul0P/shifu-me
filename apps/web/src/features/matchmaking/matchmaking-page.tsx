import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/feedback';
import { useAuth } from '@/features/auth/auth-context';
import { lobbyPollInterval, lobbyRequest } from './lobby-api';

export function MatchmakingPage() {
  const { user, token } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const started = useRef(false);
  const [now, setNow] = useState(Date.now);
  const key = ['lobby', user?.id];
  const join = useMutation({
    mutationFn: () => lobbyRequest('/api/matchmaking/join', token, 'POST'),
    onSuccess: async (state) => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData(key, state);
    },
  });
  const leave = useMutation({
    mutationFn: async () => {
      await client.cancelQueries({ queryKey: key });
      return lobbyRequest('/api/matchmaking/leave', token, 'DELETE');
    },
    onSuccess: async (state) => {
      await client.cancelQueries({ queryKey: key });
      client.setQueryData(key, state);
      void navigate(state.status === 'matched' ? { to: '/game/$gameId', params: { gameId: state.gameId } } : { to: '/' });
    },
  });
  const lobby = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => lobbyRequest('/api/matchmaking/status', token, 'GET', signal),
    enabled: join.isSuccess && !leave.isPending && !leave.isSuccess,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.status === 'searching' ? lobbyPollInterval(query.state.data, query.state.fetchFailureCount) : false),
  });

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      join.mutate();
    }
  }, [join.mutate]);

  useEffect(() => {
    if (join.isSuccess && lobby.data?.status === 'matched') {
      void navigate({ to: '/game/$gameId', params: { gameId: lobby.data.gameId }, replace: true });
    }
  }, [join.isSuccess, lobby.data, navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const state = join.isSuccess ? lobby.data : undefined;
  const elapsed = state?.status === 'searching' ? Math.max(0, Math.floor((now - Date.parse(state.joinedAt)) / 1_000)) : 0;
  const time = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const error = join.error ?? lobby.error ?? leave.error;

  return (
    <section className="arcade-card space-y-5 bg-white p-6 text-center sm:p-10">
      <div className="search-pulse text-6xl" aria-hidden="true">
        {user?.avatar ?? '🔎'}
      </div>
      <h1 className="title text-2xl">RECHERCHE D’UN ADVERSAIRE</h1>
      <p role="status" className="text-sm font-bold">
        {join.isPending
          ? 'Placement dans la file…'
          : state?.status === 'matched'
            ? 'Adversaire trouvé. Direction l’arène !'
            : state?.status === 'waiting'
              ? 'Tu as déjà une salle privée ouverte.'
              : state?.status === 'idle'
                ? 'La recherche a expiré. Tu peux la relancer.'
                : 'À la recherche d’un joueur prêt à en découdre…'}
      </p>
      <div className="arcade-chip title inline-block bg-cyber px-4 py-2 text-4xl" role="timer" aria-label="Temps passé dans la file">
        {time}
      </div>
      <FormMessage error={error} />
      <div className="flex flex-wrap justify-center gap-3">
        {state?.status === 'waiting' ? (
          <Button asChild>
            <Link to="/rooms">RETROUVER MA SALLE</Link>
          </Button>
        ) : join.isError || state?.status === 'idle' ? (
          <Button onClick={() => join.mutate()} disabled={join.isPending}>
            RELANCER LA RECHERCHE
          </Button>
        ) : lobby.isError ? (
          <Button
            onClick={() => {
              void lobby.refetch();
            }}
          >
            RÉESSAYER
          </Button>
        ) : null}
        <Button variant="destructive" onClick={() => leave.mutate()} disabled={join.isPending || leave.isPending || state?.status === 'matched'}>
          {leave.isPending ? 'ANNULATION…' : 'ANNULER'}
        </Button>
      </div>
      <p className="text-xs font-bold text-neutral-600">La partie commence automatiquement dès qu’un adversaire est trouvé.</p>
    </section>
  );
}
