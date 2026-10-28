import { deferred, expect, refetchCache, test } from '../helpers/api';
import { USER_ID } from '../helpers/data';

test('modifier seulement le pseudo préserve un avatar historique et permet ensuite un choix explicite', async ({ page, api }) => {
  api.profile.avatar = '🙂';
  await page.goto('/profile');
  await expect(page.getByLabel('PSEUDO', { exact: true })).toHaveValue(api.profile.username);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await page.getByLabel('PSEUDO', { exact: true }).fill('NouveauPseudo');
  await page.getByRole('button', { name: 'ENREGISTRER', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Profil mis à jour !');
  expect(api.requests.find(({ method }) => method === 'PUT')?.body).toEqual({ username: 'NouveauPseudo' });
  expect(api.profile.avatar).toBe('🙂');
  await page.getByRole('radio', { name: 'Dragon', exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'ENREGISTRER', exact: true }).click();
  await expect.poll(() => api.profile.avatar).toBe('🐉');
});

test('une lecture lente ne remplace pas un profil fraîchement enregistré', async ({ page, api }) => {
  await page.goto('/profile');
  await expect(page.getByLabel('PSEUDO', { exact: true })).toHaveValue(api.profile.username);
  const started = deferred();
  const release = deferred();
  await page.route('**/api/users/me', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const old = structuredClone(api.profile);
    started.release();
    await release.promise;
    await route.fulfill({ json: old });
  });
  await refetchCache(page, ['profile']);
  await started.promise;
  const cancelled = page.waitForEvent('requestfailed', { predicate: (request) => new URL(request.url()).pathname === '/api/users/me' });
  await page.getByLabel('PSEUDO', { exact: true }).fill('ProfilActualise');
  await page.getByRole('button', { name: 'ENREGISTRER', exact: true }).click();
  await expect(page.getByRole('link', { name: /Modifier le profil de ProfilActualise/ })).toBeVisible();
  await cancelled;
  release.release();
  await expect(page.getByRole('link', { name: /Modifier le profil de ProfilActualise/ })).toBeVisible();
  expect(api.profile.username).toBe('ProfilActualise');
});

test('la suppression exige un mot de passe et nettoie la session après confirmation', async ({ page, api }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'SUPPRIMER MON COMPTE', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'SUPPRIMER DÉFINITIVEMENT', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('mot de passe actuel');
  expect(api.requests.filter(({ method }) => method === 'DELETE')).toHaveLength(0);
  await dialog.getByLabel('TON MOT DE PASSE ACTUEL').fill('MotDePasse!123');
  await dialog.getByRole('button', { name: 'SUPPRIMER DÉFINITIVEMENT', exact: true }).click();
  await expect.poll(() => api.requests.filter(({ method }) => method === 'DELETE').length).toBe(1);
  expect(api.requests.find(({ method }) => method === 'DELETE')?.body).toEqual({ password: 'MotDePasse!123' });
  await expect(page.getByRole('link', { name: 'CONNEXION', exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('shifu.session'))).toBeNull();
});

test('une session révoquée redirige vers la connexion et efface le stockage local', async ({ page, api }) => {
  await page.route('**/api/users/me', (route) => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Session révoquée' } } }));
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Ta session a expiré. Reconnecte-toi pour continuer.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('shifu.session'))).toBeNull();
  expect(api.profile.id).toBe(USER_ID);
});
