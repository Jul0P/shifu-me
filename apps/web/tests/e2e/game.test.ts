import { expect, test } from '../helpers/api';
import { completedGame, GAME_ID, makeGame, ROUND_ID } from '../helpers/data';

test('le premier coup est envoyé avec la manche courante et verrouille les trois boutons', async ({ page, api }) => {
  api.game.opponent.submitted = true;
  await page.goto(`/game/${GAME_ID}`);
  await expect(page.getByRole('img', { name: 'Coup adverse verrouillé et caché' })).toBeVisible();
  await page.getByRole('button', { name: 'PIERRE', exact: true }).click();
  for (const name of ['PIERRE', 'FEUILLE', 'CISEAUX']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await expect(page.getByText('Coup verrouillé. Révélation à la fin du chrono !', { exact: true })).toBeVisible();
  expect(api.requests.filter(({ path }) => path.endsWith('/action'))).toHaveLength(1);
  expect(api.requests.find(({ path }) => path.endsWith('/action'))?.body).toEqual({ roundId: ROUND_ID, move: 'rock' });
});

test('un résultat précédent ne dévoile pas le coup adverse de la manche suivante', async ({ page, api }) => {
  const previous = completedGame().lastResult;
  api.game = makeGame({ lastResult: previous, round: { ...makeGame().round, number: 5 } });
  await page.goto(`/game/${GAME_ID}`);
  await expect(page.getByRole('img', { name: 'Coup adverse caché', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Coup adverse : scissors', exact: true })).toHaveCount(0);
});

test('la révélation affiche les coups résolus sans autoriser une nouvelle soumission', async ({ page, api }) => {
  api.game = makeGame({
    phase: 'REVEAL',
    lastResult: completedGame().lastResult,
    round: { ...makeGame().round, startsAt: new Date(Date.now() + 2600).toISOString(), endsAt: new Date(Date.now() + 12600).toISOString() },
  });
  await page.goto(`/game/${GAME_ID}`);
  await expect(page.getByRole('img', { name: 'Coup adverse : scissors', exact: true })).toBeVisible();
  await expect(page.getByText('Manche gagnée !', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PIERRE', exact: true })).toBeDisabled();
});

test('une partie annulée ne propose pas l’historique et arrête le polling', async ({ page, api }) => {
  api.game = makeGame({ status: 'CANCELLED', phase: 'FINISHED', consecutiveBothAfk: 5 });
  await page.goto(`/game/${GAME_ID}`);
  await expect(page.getByRole('dialog')).toContainText('PARTIE ANNULÉE.');
  await expect(page.getByRole('dialog')).toContainText('aucun Elo perdu');
  await expect(page.getByRole('dialog').getByRole('link', { name: '📜 MON HISTORIQUE', exact: true })).toHaveCount(0);
  const reads = api.requests.filter(({ path }) => path.endsWith('/poll')).length;
  await page.clock.install();
  await page.clock.runFor(6000);
  expect(api.requests.filter(({ path }) => path.endsWith('/poll'))).toHaveLength(reads);
});

test('un lien de partie invalide est refusé avant tout appel au moteur', async ({ page, api }) => {
  await page.goto('/game/invalide');
  await expect(page.getByText('Ce lien de partie est invalide.', { exact: true })).toBeVisible();
  expect(api.requests.some(({ path }) => path.startsWith('/api/game/'))).toBe(false);
});

test('une erreur de soumission affiche le refus du serveur sans rejouer la mutation', async ({ page, api }) => {
  await page.route(`**/api/game/${GAME_ID}/action`, (route) => route.fulfill({ status: 409, json: { error: { code: 'ROUND_EXPIRED', message: 'Délai dépassé, coup refusé' } } }));
  await page.goto(`/game/${GAME_ID}`);
  await page.getByRole('button', { name: 'PIERRE', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Délai dépassé, coup refusé');
  expect(api.game.me.move).toBeNull();
});
