import { GAME_CONFIG, type GameResponse } from '@shifu/shared';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Feedback, FormMessage } from '@/components/ui/feedback';
import { MOVES, moveEmoji } from './game-api';
import { GameResult } from './game-result';
import { RoundHistory } from './round-history';
import { useGame } from './use-game';

const SCORE_MARKERS = Array.from({ length: GAME_CONFIG.WINS_TO_VICTORY }, (_, index) => index + 1);

function PlayerScore({ player, score, me }: { player: GameResponse['opponent']; score: number; me?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-4xl" aria-hidden="true">
        {player.avatar}
      </div>
      <p className="title mt-2 truncate text-xs">
        {player.username}
        {me && <span className="text-[9px]"> · TOI</span>}
      </p>
      <div className="mt-2 flex justify-center gap-1" role="img" aria-label={`${score} manches gagnées sur ${GAME_CONFIG.WINS_TO_VICTORY}`}>
        {SCORE_MARKERS.map((win) => (
          <span key={win} className={`size-4 rounded-full border-3 border-black ${win <= score ? 'bg-mint' : 'bg-white'}`} />
        ))}
      </div>
    </div>
  );
}

function roundMessage(game: GameResponse): string {
  if (!game.lastResult) {
    return 'Préparation de la prochaine manche…';
  }
  if (game.lastResult.outcome === 'TIE') {
    return 'Égalité ! Aucun point. On recommence.';
  }
  if (game.lastResult.outcome === 'BOTH_AFK') {
    return `Aucun coup joué. Double absence ${game.consecutiveBothAfk}/${GAME_CONFIG.MAX_CONSECUTIVE_BOTH_AFK}.`;
  }
  const forfeit = !game.lastResult.player1Move || !game.lastResult.player2Move;

  return (game.lastResult.outcome === game.side ? 'Manche gagnée !' : 'Manche perdue.') + (forfeit ? ' Un joueur n’a pas joué à temps.' : '');
}

export function GamePage({ gameId }: { gameId: string }) {
  const { query, game, action, remaining, startingIn } = useGame(gameId);
  const [showRounds, setShowRounds] = useState(false);

  if (!game) {
    return (
      <Feedback
        title={query.isError ? 'Partie indisponible' : 'Entrée dans l’arène…'}
        loading={query.isPending}
        error={query.error}
        onRetry={
          query.isError
            ? () => {
                void query.refetch();
              }
            : undefined
        }
      />
    );
  }

  const finished = game.status !== 'PLAYING';
  const reveal = game.phase === 'REVEAL' || finished;
  const myResult = game.side === 'PLAYER_1' ? game.lastResult?.player1Move : game.lastResult?.player2Move;
  const opponentResult = game.side === 'PLAYER_1' ? game.lastResult?.player2Move : game.lastResult?.player1Move;
  const locked = game.me.submitted;
  const canChoose = !finished && game.phase === 'CHOOSING' && startingIn === 0 && remaining > 0 && !locked && !action.isPending && !query.isError;
  const seconds = Math.ceil((game.phase === 'REVEAL' ? startingIn : remaining) / 1_000);
  const status = reveal ? roundMessage(game) : remaining === 0 ? 'Temps écoulé. L’arbitre prépare le résultat…' : locked ? 'Coup verrouillé. Révélation à la fin du chrono !' : action.isPending ? 'Envoi de ton choix…' : 'Choisis ton coup. Une fois envoyé, c’est joué !';
  const otherHand = reveal && game.lastResult ? moveEmoji(opponentResult ?? null) : game.opponent.submitted ? '🔒' : '❔';
  const myHand = reveal && game.lastResult ? moveEmoji(myResult ?? null) : game.me.move ? moveEmoji(game.me.move) : '❔';

  return (
    <section className="space-y-4">
      <h1 className="sr-only">Duel contre {game.opponent.username}</h1>
      <div className="arcade-card bg-white p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <PlayerScore player={game.me} score={game.score.me} me />
          <div className="title">
            <p className="text-[10px]">MANCHE</p>
            <p className="text-3xl">{reveal && game.lastResult ? game.lastResult.roundNumber : game.round.number}</p>
            <p className="mt-1 text-xs">
              {game.score.me} — {game.score.opponent}
            </p>
          </div>
          <PlayerScore player={game.opponent} score={game.score.opponent} />
        </div>
        {game.roomCode && (
          <p className="mt-3 text-center">
            <span className="arcade-chip inline-block bg-cyber px-2 py-1 text-[10px] font-bold">SALLE PRIVÉE · {game.roomCode}</span>
          </p>
        )}
      </div>
      <div className="arcade-card bg-white p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div className={`arcade-chip title min-w-16 px-3 py-1 text-center text-3xl ${!reveal && seconds <= 3 ? 'bg-coral' : 'bg-cyber'}`} aria-label={finished ? 'Partie terminée' : `${seconds} secondes restantes`} role="timer">
            {finished ? '✓' : Math.min(10, seconds)}
          </div>
          <div className="flex-1">
            <p className="title mb-2 text-[10px]">{finished ? 'MATCH TERMINÉ' : reveal ? 'PROCHAINE MANCHE' : 'LE CHRONO DÉCIDE'}</p>
            <div role="progressbar" aria-label="Temps restant de la manche" aria-valuemin={0} aria-valuemax={10} aria-valuenow={finished ? 0 : Math.min(10, seconds)} className="arcade-chip h-4 overflow-hidden bg-white">
              <div
                className={`h-full ${seconds <= 3 ? 'bg-coral' : 'bg-mint'}`}
                style={{
                  width: `${(finished ? 0 : reveal ? startingIn / GAME_CONFIG.ROUND_REVEAL_MS : remaining / GAME_CONFIG.ROUND_DURATION_MS) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
          <div key={reveal ? game.lastResult?.id : game.round.id} role="img" className={`text-6xl leading-none sm:text-7xl ${reveal ? 'pop' : ''}`} aria-label={`Ton coup : ${reveal ? (myResult ?? 'absent') : (game.me.move ?? 'pas encore choisi')}`}>
            {myHand}
          </div>
          <span className="title text-xl" aria-hidden="true">
            VS
          </span>
          <div className={`text-6xl leading-none sm:text-7xl ${reveal ? 'pop' : ''}`} role="img" aria-label={reveal ? `Coup adverse : ${opponentResult ?? 'absent'}` : game.opponent.submitted ? 'Coup adverse verrouillé et caché' : 'Coup adverse caché'}>
            {otherHand}
          </div>
        </div>
        <p role="status" className={`arcade-chip mt-5 flex min-h-14 items-center justify-center px-3 py-2 text-center text-sm font-bold ${locked && !reveal ? 'bg-mint' : 'bg-cyber'}`}>
          {status}
        </p>
        {!finished && !game.opponent.connected && <p className="mt-3 text-center text-xs font-bold">L’adversaire ne répond plus pour le moment. Le chrono continue.</p>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MOVES.map((move) => (
          <button
            key={move.value}
            type="button"
            className="arcade-button bg-white px-2 py-4 disabled:opacity-45 aria-pressed:disabled:opacity-100"
            disabled={!canChoose}
            aria-label={move.label}
            aria-pressed={!reveal && game.me.move === move.value}
            onClick={() => action.mutate({ roundId: game.round.id, move: move.value })}
          >
            <span className="block text-4xl" aria-hidden="true">
              {move.emoji}
            </span>
            <span className="mt-2 block text-xs font-bold">{move.label}</span>
          </button>
        ))}
      </div>
      <FormMessage error={action.error ?? query.error} />
      {query.isError && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            void query.refetch();
          }}
        >
          RÉTABLIR LA CONNEXION
        </Button>
      )}
      {finished && <GameResult key={game.id} game={game} />}
      <details className="arcade-card bg-white p-4" onToggle={(event) => setShowRounds(event.currentTarget.open)}>
        <summary className="title min-h-8 text-sm">📜 DÉTAIL DES MANCHES</summary>
        {showRounds && (
          <div className="mt-3">
            <RoundHistory game={game} />
          </div>
        )}
      </details>
      <div className="text-center">
        <Link to="/" className="inline-flex min-h-11 items-center text-xs font-bold underline">
          ← retour à l’accueil
        </Link>
        {!finished && <p className="text-xs font-bold">Le match et le chrono continuent si tu quittes cette page.</p>}
      </div>
    </section>
  );
}
