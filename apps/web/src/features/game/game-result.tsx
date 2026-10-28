import type { GameResponse } from '@shifu/shared';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

export function GameResult({ game }: { game: GameResponse }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelled = game.status === 'CANCELLED';
  const won = game.finish?.winnerId === game.me.id;
  const title = cancelled ? 'PARTIE ANNULÉE.' : won ? 'VICTOIRE !' : 'BIEN JOUÉ QUAND MÊME.';
  const description = cancelled ? '5 manches consécutives sans aucun coup : aucun Elo perdu, aucun match ajouté à l’historique.' : won ? 'Le chrono a parlé. Ce duel est pour toi !' : 'Un duel de perdu, une revanche à prendre.';

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <>
      <div className={`arcade-card space-y-3 p-5 text-center ${cancelled ? 'bg-white' : won ? 'bg-mint' : 'bg-coral'}`}>
        <h2 className="title text-xl">{title}</h2>
        <p className="text-sm font-bold">{description}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/play">REJOUER</Link>
          </Button>
          <Button variant="outline" onClick={() => dialog.current?.showModal()}>
            VOIR LE RÉSULTAT
          </Button>
        </div>
      </div>
      <dialog ref={dialog} aria-labelledby="result-title" aria-describedby="result-description" className="arcade-card m-auto w-[calc(100%-2rem)] max-w-md bg-white p-6 text-center">
        <button type="button" className="absolute top-2 right-2 min-h-11 min-w-11 text-2xl" aria-label="Fermer le résultat" onClick={() => dialog.current?.close()}>
          ×
        </button>
        <div className="mt-2 text-6xl" aria-hidden="true">
          {cancelled ? '💤' : won ? '🏆' : '🥊'}
        </div>
        <h2 id="result-title" className="title mt-5 text-2xl">
          {title}
        </h2>
        <p id="result-description" className="mt-3 text-sm font-bold">
          {description}
        </p>
        <p className="title my-5 text-4xl">
          {game.score.me} — {game.score.opponent}
        </p>
        <div className={`arcade-chip inline-block px-4 py-2 font-bold ${cancelled ? 'bg-cyber' : won ? 'bg-mint' : 'bg-coral'}`}>
          {(game.finish?.myDelta ?? 0) > 0 ? '+' : ''}
          {game.finish?.myDelta ?? 0} ELO · TOTAL {game.finish?.myElo ?? game.me.elo}
        </div>
        <div className="mt-6 grid gap-3">
          <Button asChild size="lg">
            <Link to={game.roomCode ? '/rooms' : '/play'}>{game.roomCode ? '🎯 NOUVEAU DÉFI' : '⚔️ REJOUER'}</Link>
          </Button>
          {!cancelled && (
            <Button asChild variant="outline">
              <Link to="/history">📜 MON HISTORIQUE</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/">RETOUR À L’ACCUEIL</Link>
          </Button>
        </div>
      </dialog>
    </>
  );
}
