import { expect, test } from '../helpers/api';
import { completedGame, GAME_ID, user } from '../helpers/data';

test('le classement charge les pages demandées et indique le rang absolu', async ({ page, api }) => {
  const pages: number[] = [];
  await page.route('**/api/users/leaderboard?*', (route) => {
    const url = new URL(route.request().url());
    const current = Number(url.searchParams.get('page'));
    pages.push(current);
    return route.fulfill({
      json: {
        items: [{ ...user, username: current === 1 ? 'PremierJoueur' : 'JoueurSuivant', rank: current === 1 ? 1 : 21, winRate: 0 }],
        page: current,
        limit: 20,
        total: 21,
        pages: 2,
      },
    });
  });
  await page.goto('/leaderboard');
  await expect(page.getByRole('rowheader', { name: /PremierJoueur/ })).toBeVisible();
  await page.getByRole('button', { name: 'Page suivante', exact: true }).click();
  await expect(page.getByRole('rowheader', { name: /JoueurSuivant/ })).toBeVisible();
  await expect(page.getByText('PAGE 2 / 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Page suivante', exact: true })).toBeDisabled();
  expect(pages).toContain(2);
  expect(api.profile.id).toBe(user.id);
});

test('l’historique ouvre la partie et les manches résolues du joueur', async ({ page, api }) => {
  api.game = completedGame();
  await page.route('**/api/users/me/history?*', (route) =>
    route.fulfill({
      json: {
        items: [{ id: 'eeeeeeeeeeeeeeeeeeeeeeee', gameId: GAME_ID, opponent: { ...user, id: api.game.opponent.id, username: 'Adversaire' }, myScore: 3, opponentScore: 1, won: true, eloDelta: 10, eloBefore: 100, eloAfter: 110, finishedAt: new Date().toISOString(), roomCode: null }],
        page: 1,
        limit: 10,
        total: 1,
        pages: 1,
      },
    }),
  );
  await page.route(`**/api/game/${GAME_ID}/rounds?*`, (route) =>
    route.fulfill({
      json: {
        items: [api.game.lastResult],
        page: 1,
        limit: 10,
        total: 1,
        pages: 1,
      },
    }),
  );
  await page.goto('/history');
  await expect(page.getByText('VICTOIRE · +10 ELO', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voir les manches →', exact: true }).click();
  await page.getByRole('button', { name: 'Fermer le résultat', exact: true }).click();
  await page.getByText('📜 DÉTAIL DES MANCHES', { exact: true }).click();
  await expect(page.getByText('MANCHE 4', { exact: true })).toBeVisible();
  await expect(page.getByText('GAGNÉE', { exact: true })).toBeVisible();
});

test('les pages privées principales restent utilisables sur un viewport mobile', async ({ page, api }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/', '/profile', '/rooms']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  }
  expect(api.profile.username).toBe(user.username);
});
