import { test as base, expect, type Page } from '@playwright/test';
import { GAME_CONFIG, type GameResponse, type LobbyResponse, type PublicUser } from '@shifu/shared';
import { completedGame, GAME_ID, makeGame, TOKEN, user } from './data';

type MockApi = {
  profile: PublicUser;
  game: GameResponse;
  lobby: LobbyResponse;
  requests: { path: string; method: string; body: unknown }[];
};

export const test = base.extend<{ api: MockApi; signedIn: boolean }>({
  signedIn: [true, { option: true }],
  api: async ({ page, signedIn }, use) => {
    const api: MockApi = { profile: structuredClone(user), game: makeGame(), lobby: { status: 'idle' }, requests: [] };
    if (signedIn) {
      await page.addInitScript(
        ({ token, userId }) => {
          if (!sessionStorage.getItem('shifu.test.initialized')) {
            sessionStorage.setItem('shifu.session', JSON.stringify({ token, userId, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }));
            sessionStorage.setItem('shifu.test.initialized', 'true');
          }
        },
        { token: TOKEN, userId: user.id },
      );
    }

    // Aucune requête ne rejoint l'API réelle, MongoDB ou un fournisseur externe.
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== 'http://127.0.0.1:4173') {
        await route.abort('blockedbyclient');
        return;
      }
      if (!url.pathname.startsWith('/api/')) {
        await route.continue();
        return;
      }
      const path = url.pathname;
      const method = request.method();
      const body: unknown = request.postData() ? request.postDataJSON() : undefined;
      api.requests.push({ path, method, body });
      let response: unknown;
      let status = 200;
      if (path === '/api/users/me') {
        if (method === 'PUT') {
          api.profile = { ...api.profile, ...request.postDataJSON() };
        }
        status = method === 'DELETE' ? 204 : 200;
        response = api.profile;
      } else if (path === '/api/auth/login' || path === '/api/auth/register') {
        status = path.endsWith('register') ? 201 : 200;
        response = { user: api.profile, token: TOKEN, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
      } else if (path === '/api/auth/logout') {
        status = 204;
      } else if (path === '/api/matchmaking/status') {
        response = api.lobby;
      } else if (path === '/api/matchmaking/join') {
        if (api.lobby.status === 'idle') {
          api.lobby = { status: 'searching', joinedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + GAME_CONFIG.QUEUE_LEASE_MS).toISOString() };
        }
        response = api.lobby;
      } else if (path === '/api/matchmaking/leave') {
        if (api.lobby.status === 'searching') {
          api.lobby = { status: 'idle' };
        }
        response = api.lobby;
      } else if (path === '/api/rooms' && method === 'POST') {
        api.lobby = { status: 'waiting', code: 'ABCD', expiresAt: new Date(Date.now() + GAME_CONFIG.ROOM_TTL_MS).toISOString() };
        response = api.lobby;
      } else if (path === '/api/rooms/ABCD/join') {
        api.game = completedGame('ABCD');
        api.lobby = { status: 'matched', gameId: GAME_ID };
        response = api.lobby;
      } else if (path === '/api/rooms/ABCD') {
        if (method === 'DELETE' && api.lobby.status === 'waiting') {
          api.lobby = { status: 'idle' };
        }
        response = api.lobby;
      } else if (path === `/api/game/${GAME_ID}/poll` || path === `/api/game/${GAME_ID}/action`) {
        if (method === 'POST') {
          api.game.me = { ...api.game.me, move: request.postDataJSON().move, submitted: true };
        }
        api.game.serverTime = new Date().toISOString();
        response = api.game;
      } else if (path === '/api/users/leaderboard' || path === '/api/users/me/history' || path === `/api/game/${GAME_ID}/rounds`) {
        response = { items: [], page: Number(url.searchParams.get('page') ?? 1), limit: Number(url.searchParams.get('limit') ?? 20), total: 0, pages: 1 };
      } else {
        throw new Error(`Route API non simulée : ${method} ${path}`);
      }
      await route.fulfill(status === 204 ? { status } : { status, json: response });
    });
    await use(api);
  },
});

export { expect };

// Permet de reproduire un ancien cache sans ajouter de point d'entrée de test au code applicatif.
export async function seedCache(page: Page, entries: { key: string[]; value: unknown }[]) {
  await page.evaluate(async (entries) => {
    const resource = performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === '/src/lib/query-client.ts');
    if (!resource) {
      throw new Error('Module du cache introuvable');
    }
    const { queryClient }: typeof import('../../src/lib/query-client') = await import(resource.name);
    for (const { key, value } of entries) {
      queryClient.setQueryData(key, value);
    }
  }, entries);
}

export async function refetchCache(page: Page, key: string[]) {
  await page.evaluate(async (key) => {
    const resource = performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === '/src/lib/query-client.ts');
    if (!resource) {
      throw new Error('Module du cache introuvable');
    }
    const { queryClient }: typeof import('../../src/lib/query-client') = await import(resource.name);
    void queryClient.refetchQueries({ queryKey: key });
  }, key);
}

// Le test contrôle explicitement quand la réponse lente peut arriver, sans pause arbitraire.
export function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
