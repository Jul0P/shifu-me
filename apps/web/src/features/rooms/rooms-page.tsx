import { type LobbyResponse, roomCodeSchema } from '@shifu/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { lobbyPollInterval, lobbyRequest } from '@/features/matchmaking/lobby-api';

export function RoomsPage() {
  const { user, token } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const key = ['lobby', user?.id];
  const lobby = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => lobbyRequest('/api/matchmaking/status', token, 'GET', signal),
    staleTime: 0,
  });
  const state = lobby.isSuccess && lobby.isFetchedAfterMount ? lobby.data : undefined;
  const code = state?.status === 'waiting' ? state.code : null;
  const room = useQuery({
    queryKey: ['room', user?.id, code],
    queryFn: ({ signal }) => lobbyRequest(`/api/rooms/${code}`, token, 'GET', signal),
    enabled: Boolean(code),
    staleTime: 0,
    refetchInterval: (query) => (query.state.error && 'status' in query.state.error && (query.state.error.status === 404 || query.state.error.status === 403) ? false : lobbyPollInterval(query.state.data, query.state.fetchFailureCount)),
  });
  const updateLobby = async (state: LobbyResponse) => {
    await client.cancelQueries({ queryKey: key });
    client.setQueryData(key, state);
    setMessage('');
  };
  const create = useMutation({ mutationFn: () => lobbyRequest('/api/rooms', token, 'POST'), onSuccess: updateLobby });
  const join = useMutation({ mutationFn: (value: string) => lobbyRequest(`/api/rooms/${value}/join`, token, 'POST'), onSuccess: updateLobby });
  const cancel = useMutation({
    mutationFn: async () => {
      await client.cancelQueries({ queryKey: key });
      await client.cancelQueries({ queryKey: ['room', user?.id, code] });
      return lobbyRequest(`/api/rooms/${code}`, token, 'DELETE');
    },
    onSuccess: async (state) => {
      await updateLobby(state);
      client.removeQueries({ queryKey: ['room', user?.id, code] });
    },
  });
  const matched = state?.status === 'matched' ? state : code && room.data?.status === 'matched' ? room.data : null;

  useEffect(() => {
    if (matched) {
      void navigate({ to: '/game/$gameId', params: { gameId: matched.gameId }, replace: true });
    }
  }, [matched, navigate]);

  useEffect(() => {
    if (room.isError) {
      void client.invalidateQueries({ queryKey: ['lobby', user?.id] });
    }
  }, [room.isError, client, user?.id]);

  const busy = create.isPending || join.isPending || cancel.isPending || lobby.isPending || !lobby.isFetchedAfterMount;
  const error = create.error ?? join.error ?? cancel.error ?? room.error ?? lobby.error;

  return (
    <section className="arcade-card space-y-5 bg-white p-5 sm:p-6">
      <h1 className="title text-2xl">🎯 DÉFIER UN AMI</h1>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant={tab === 'create' ? 'yellow' : 'outline'}
          disabled={busy}
          onClick={() => {
            setTab('create');
            setMessage('');
            create.reset();
            join.reset();
          }}
        >
          CRÉER UNE SALLE
        </Button>
        <Button
          variant={tab === 'join' ? 'yellow' : 'outline'}
          disabled={busy || Boolean(code)}
          onClick={() => {
            setTab('join');
            setMessage('');
            create.reset();
            join.reset();
          }}
        >
          REJOINDRE
        </Button>
      </div>
      {state?.status === 'searching' ? (
        <div className="space-y-4 text-center">
          <p className="text-sm font-bold">Une recherche d’adversaire est déjà en cours. Annule-la avant de créer une salle.</p>
          <Button asChild>
            <Link to="/play">RETOUR À LA RECHERCHE</Link>
          </Button>
        </div>
      ) : code ? (
        <div className="space-y-4 text-center">
          <p className="text-sm font-bold">Donne ce code à ton adversaire :</p>
          <div className="arcade-chip title inline-block select-all bg-cyber px-6 py-2 text-4xl tracking-widest" role="status" aria-label="Code de la salle">
            {code}
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(code).then(
                  () => setMessage('Code copié !'),
                  () => setMessage('Sélectionne le code pour le copier manuellement.'),
                );
                if (!navigator.clipboard) {
                  setMessage('Sélectionne le code pour le copier manuellement.');
                }
              }}
            >
              <Copy size={16} aria-hidden="true" /> COPIER LE CODE
            </Button>
          </div>
          <p role="status" className="text-sm font-bold">
            En attente de ton adversaire…
          </p>
          <p className="text-xs font-bold text-neutral-600">La salle expire après 10 minutes. Annule-la pour en rejoindre une autre.</p>
          <Button variant="destructive" disabled={busy} onClick={() => cancel.mutate()}>
            {cancel.isPending ? 'ANNULATION…' : 'ANNULER LA SALLE'}
          </Button>
        </div>
      ) : tab === 'create' ? (
        <div className="space-y-4 text-center">
          <div className="text-5xl" aria-hidden="true">
            🎟️
          </div>
          <p className="text-sm font-bold">Une salle, un code, un duel. Ton ami peut te rejoindre depuis son compte.</p>
          <Button className="w-full" size="lg" disabled={busy} onClick={() => create.mutate()}>
            {create.isPending ? 'CRÉATION…' : 'CRÉER MA SALLE'}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const result = roomCodeSchema.safeParse(input);
            join.reset();
            if (!result.success) {
              setMessage('Le code doit contenir 4 caractères, sans I, O, 0 ni 1.');
              return;
            }
            setMessage('');
            join.mutate(result.data);
          }}
        >
          <div className="space-y-2">
            <label htmlFor="room-code" className="title text-xs">
              CODE DE LA SALLE (4 CARACTÈRES)
            </label>
            <Input id="room-code" placeholder="CODE" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={4} value={input} onChange={(event) => setInput(event.target.value.toUpperCase())} className="title py-3 text-center text-3xl tracking-widest" disabled={busy} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {join.isPending ? 'CONNEXION…' : 'REJOINDRE LA SALLE'}
          </Button>
        </form>
      )}
      <FormMessage error={error} message={message} />
      {lobby.isError && (
        <Button
          variant="outline"
          onClick={() => {
            void lobby.refetch();
          }}
        >
          RÉESSAYER
        </Button>
      )}
      <Link to="/" className="inline-flex min-h-11 items-center text-xs font-bold underline">
        ← retour à l’accueil
      </Link>
    </section>
  );
}
