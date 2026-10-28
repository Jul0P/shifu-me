import { GAME_CONFIG } from '@shifu/shared';
import { describe, expect, it, vi } from 'vitest';
import { latestSnapshot, moveEmoji, requestGame } from '../../src/features/game/game-api';
import { lobbyPollInterval } from '../../src/features/matchmaking/lobby-api';
import { GAME_ID, makeGame, ROUND_ID } from '../helpers/data';

describe('État et horloge de partie', () => {
  it('conserve un état récent si une ancienne requête termine après lui', () => {
    const next = { game: makeGame(), receivedAt: 20, serverAtReceipt: 200 };
    const previous = { ...next, game: { ...next.game, serverTime: new Date(Date.parse(next.game.serverTime) + 1000).toISOString() } };
    expect(latestSnapshot(previous, next)).toBe(previous);
    expect(latestSnapshot(next, previous)).toBe(previous);
    expect(latestSnapshot(undefined, next)).toBe(next);
  });

  it('autorise un nouvel état ayant le même timestamp', () => {
    const previous = { game: makeGame(), receivedAt: 10, serverAtReceipt: 100 };
    const next = { ...previous, receivedAt: 20 };
    expect(latestSnapshot(previous, next)).toBe(next);
  });

  it('estime l’horloge serveur avec la moitié du temps aller-retour', async () => {
    const game = makeGame();
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(300);
    const fetch = vi.fn().mockResolvedValue(Response.json(game));
    vi.stubGlobal('fetch', fetch);
    const result = await requestGame(GAME_ID);
    expect(fetch.mock.calls[0][0]).toBe(`http://localhost:3000/api/game/${GAME_ID}/poll`);
    expect(result.serverAtReceipt).toBe(Date.parse(game.serverTime) + 100);
    expect(result.receivedAt).toBe(300);
  });

  it('adresse les soumissions au endpoint action avec la manche courante', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(makeGame()));
    vi.stubGlobal('fetch', fetch);
    await requestGame(GAME_ID, { method: 'POST', body: JSON.stringify({ roundId: ROUND_ID, move: 'rock' }) });
    expect(fetch.mock.calls[0][0]).toBe(`http://localhost:3000/api/game/${GAME_ID}/action`);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ roundId: ROUND_ID, move: 'rock' });
  });

  it.each([
    ['rock', '✊'],
    ['paper', '✋'],
    ['scissors', '✌️'],
    [null, '💤'],
  ] as const)('affiche le symbole du coup %s', (move, emoji) => {
    expect(moveEmoji(move)).toBe(emoji);
  });
});

describe('Polling du lobby', () => {
  it('utilise la cadence partagée et ralentit les tentatives en échec jusqu’à 10 secondes', () => {
    expect(lobbyPollInterval(undefined)).toBe(GAME_CONFIG.MATCHMAKING_POLL_MS);
    expect(lobbyPollInterval({ status: 'idle' }, 2)).toBe(4000);
    expect(lobbyPollInterval(undefined, 20)).toBe(10000);
  });

  it('arrête le polling dès qu’une partie est attribuée', () => {
    expect(lobbyPollInterval({ status: 'matched', gameId: GAME_ID })).toBe(false);
  });
});
