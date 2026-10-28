import { deferred, expect, refetchCache, seedCache, test } from '../helpers/api';
import { completedGame, GAME_ID, USER_ID } from '../helpers/data';

test('la recherche peut être annulée et son polling s’arrête après la sortie', async ({ page, api }) => {
  await page.goto('/play');
  await expect.poll(() => api.lobby.status).toBe('searching');
  await expect(page.getByRole('button', { name: 'ANNULER', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'ANNULER', exact: true }).click();
  await expect(page).toHaveURL('/');
  expect(api.lobby.status).toBe('idle');
  const reads = api.requests.filter(({ path }) => path === '/api/matchmaking/status').length;
  await page.clock.install();
  await page.clock.runFor(5000);
  expect(api.requests.filter(({ path }) => path === '/api/matchmaking/status')).toHaveLength(reads);
});

test('une annulation déjà appariée conserve la partie au lieu de revenir à l’accueil', async ({ page, api }) => {
  api.game = completedGame();
  await page.goto('/play');
  await expect(page.getByRole('button', { name: 'ANNULER', exact: true })).toBeEnabled();
  api.lobby = { status: 'matched', gameId: GAME_ID };
  await page.getByRole('button', { name: 'ANNULER', exact: true }).click();
  await expect(page).toHaveURL(`/game/${GAME_ID}`);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('rejouer ne suit pas l’ancien match public présent dans le cache', async ({ page, api }) => {
  api.game = completedGame();
  await page.goto(`/game/${GAME_ID}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await seedCache(page, [{ key: ['lobby', USER_ID], value: { status: 'matched', gameId: GAME_ID } }]);
  const started = deferred();
  const release = deferred();
  await page.route('**/api/matchmaking/join', async (route) => {
    started.release();
    await release.promise;
    await route.fallback();
  });
  await page.getByRole('dialog').getByRole('link', { name: '⚔️ REJOUER', exact: true }).click();
  await started.promise;
  await expect(page).toHaveURL('/play');
  await expect(page.getByRole('button', { name: 'ANNULER', exact: true })).toBeDisabled();
  release.release();
  await expect(page.getByRole('button', { name: 'ANNULER', exact: true })).toBeEnabled();
  await expect(page).toHaveURL('/play');
});

test('un nouveau défi privé attend le lobby actualisé avant de suivre une ancienne salle', async ({ page, api }) => {
  api.game = completedGame('ABCD');
  await page.goto(`/game/${GAME_ID}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await seedCache(page, [
    { key: ['lobby', USER_ID], value: { status: 'waiting', code: 'ABCD', expiresAt: new Date(Date.now() + 600000).toISOString() } },
    { key: ['room', USER_ID, 'ABCD'], value: { status: 'matched', gameId: GAME_ID } },
  ]);
  const started = deferred();
  const release = deferred();
  await page.route('**/api/matchmaking/status', async (route) => {
    started.release();
    await release.promise;
    await route.fallback();
  });
  await page.getByRole('dialog').getByRole('link', { name: '🎯 NOUVEAU DÉFI', exact: true }).click();
  await started.promise;
  await expect(page).toHaveURL('/rooms');
  await expect(page.getByRole('button', { name: 'CRÉER MA SALLE', exact: true })).toBeDisabled();
  release.release();
  await expect(page.getByRole('button', { name: 'CRÉER MA SALLE', exact: true })).toBeEnabled();
  await expect(page).toHaveURL('/rooms');
});

test('une salle peut être créée, annulée puis rejointe avec validation du code', async ({ page, api }) => {
  await page.goto('/rooms');
  await page.getByRole('button', { name: 'CRÉER MA SALLE', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Code de la salle' })).toHaveText('ABCD');
  await page.getByRole('button', { name: 'ANNULER LA SALLE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'CRÉER MA SALLE', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'REJOINDRE', exact: true }).click();
  await page.getByLabel('CODE DE LA SALLE (4 CARACTÈRES)').fill('IO01');
  await page.getByRole('button', { name: 'REJOINDRE LA SALLE', exact: true }).click();
  await expect(page.getByText('Le code doit contenir 4 caractères, sans I, O, 0 ni 1.', { exact: true })).toBeVisible();
  expect(api.requests.filter(({ path }) => path.endsWith('/join') && path.includes('/rooms/'))).toHaveLength(0);
  await page.getByLabel('CODE DE LA SALLE (4 CARACTÈRES)').fill('abcd');
  await page.getByRole('button', { name: 'REJOINDRE LA SALLE', exact: true }).click();
  await expect(page).toHaveURL(`/game/${GAME_ID}`);
});

test('une erreur du lobby est visible sur l’accueil et une nouvelle tentative peut réussir', async ({ page, api }) => {
  let failed = true;
  await page.route('**/api/matchmaking/status', (route) => (failed ? route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Lobby indisponible' } } }) : route.fallback()));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Recherche indisponible', exact: true })).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'RÉESSAYER', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recherche indisponible', exact: true })).toHaveCount(0);
  expect(api.lobby.status).toBe('idle');
});

test('une ancienne lecture du lobby ne fait pas disparaître le code d’une salle créée', async ({ page, api }) => {
  await page.goto('/rooms');
  await expect(page.getByRole('button', { name: 'CRÉER MA SALLE', exact: true })).toBeEnabled();
  const started = deferred();
  const release = deferred();
  await page.route('**/api/matchmaking/status', async (route) => {
    started.release();
    await release.promise;
    await route.fulfill({ json: { status: 'idle' } });
  });
  await refetchCache(page, ['lobby']);
  await started.promise;
  const cancelled = page.waitForEvent('requestfailed', { predicate: (request) => new URL(request.url()).pathname === '/api/matchmaking/status' });
  await page.getByRole('button', { name: 'CRÉER MA SALLE', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Code de la salle' })).toHaveText('ABCD');
  await cancelled;
  release.release();
  await expect(page.getByRole('status', { name: 'Code de la salle' })).toHaveText('ABCD');
  expect(api.lobby.status).toBe('waiting');
});
