import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiFetch, apiRequest, authEvents, errorMessage } from '../../src/lib/api-client';

afterEach(() => vi.useRealTimers());

describe('Client HTTP', () => {
  it('envoie le JWT, le JSON et les options sans cookie ni cache', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    await expect(apiFetch('/api/exemple', { token: 'jeton-fictif', method: 'POST', body: '{}', headers: { 'X-Example': 'oui' } })).resolves.toEqual({ ok: true });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/exemple');
    expect(options.headers.get('Authorization')).toBe('Bearer jeton-fictif');
    expect(options.headers.get('Content-Type')).toBe('application/json');
    expect(options.headers.get('X-Example')).toBe('oui');
    expect(options).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'omit' });
  });

  it('ne force pas de Content-Type ou de JWT pour une lecture publique', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal('fetch', fetch);
    await apiFetch('/api/exemple');
    expect(fetch.mock.calls[0][1].headers.has('Authorization')).toBe(false);
    expect(fetch.mock.calls[0][1].headers.has('Content-Type')).toBe(false);
  });

  it('accepte une réponse 204 sans tenter de lire du JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiFetch('/api/exemple')).resolves.toBeUndefined();
  });

  it('conserve le statut, le code et le message métier d’une erreur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'MOVE_LOCKED', message: 'Coup verrouillé' } }, { status: 409 })));
    await expect(apiFetch('/api/exemple')).rejects.toMatchObject({ status: 409, code: 'MOVE_LOCKED', message: 'Coup verrouillé' });
  });

  it('signale une erreur HTTP même si sa réponse est du HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Erreur</html>', { status: 503 })));
    await expect(apiFetch('/api/exemple')).rejects.toMatchObject({ status: 503, code: 'HTTP_ERROR' });
  });

  it('signale un JSON réussi mais mal formé comme réponse serveur invalide', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('pas du JSON')));
    await expect(apiFetch('/api/exemple')).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' });
  });

  it('valide aussi la forme des réponses avec le schéma Zod', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => Response.json({ id: 12 })),
    );
    await expect(apiRequest('/api/exemple', z.object({ id: z.string() }))).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(apiRequest('/api/exemple', z.object({ id: z.number() }))).resolves.toEqual({ id: 12 });
  });

  it('émet une expiration uniquement pour une requête authentifiée refusée en 401', async () => {
    const listener = vi.fn();
    authEvents.addEventListener('expired', listener);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => new Response(null, { status: 401 })),
    );
    try {
      await expect(apiFetch('/api/exemple')).rejects.toBeInstanceOf(ApiError);
      expect(listener).not.toHaveBeenCalled();
      await expect(apiFetch('/api/exemple', { token: 'ancienne-session' })).rejects.toBeInstanceOf(ApiError);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail).toBe('ancienne-session');
    } finally {
      authEvents.removeEventListener('expired', listener);
    }
  });

  it('transmet l’annulation du composant au signal réseau', async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal('fetch', fetch);
    await apiFetch('/api/exemple', { signal: controller.signal });
    const signal: AbortSignal = fetch.mock.calls[0][1].signal;
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it('ne transforme pas une annulation pendant la lecture du corps en JSON invalide', async () => {
    const error = new DOMException('Lecture annulée', 'AbortError');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw error;
        },
      }),
    );
    await expect(apiFetch('/api/exemple')).rejects.toBe(error);
  });

  it.each([
    [new ApiError(409, 'CONFLICT', 'Pseudo déjà utilisé'), 'Pseudo déjà utilisé'],
    [new DOMException('Délai', 'TimeoutError'), 'Le serveur met trop de temps à répondre. Réessaie.'],
    [new TypeError('fetch failed'), 'Connexion impossible. Vérifie ton réseau puis réessaie.'],
  ])('présente un message compréhensible pour %s', (error, message) => {
    expect(errorMessage(error)).toBe(message);
  });
});
