import { expect, test } from '../helpers/api';
import { TOKEN, USER_ID } from '../helpers/data';

test.use({ signedIn: false });

test('une page privée redirige un visiteur vers la connexion', async ({ page, api }) => {
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
  expect(api.requests.some(({ path }) => path === '/api/users/me')).toBe(false);
});

test('la connexion crée une session, survit au rechargement puis se déconnecte', async ({ page, api }) => {
  await page.goto('/login');
  await page.getByLabel('PSEUDO', { exact: true }).fill('JoueurTest');
  await page.getByLabel('MOT DE PASSE', { exact: true }).fill('MotDePasse!123');
  await page.getByRole('button', { name: 'ME CONNECTER', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'JoueurTest', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('shifu.session') ?? 'null'))).toMatchObject({ token: TOKEN, userId: USER_ID });
  await page.reload();
  await expect(page.getByRole('link', { name: /Modifier le profil de JoueurTest/ })).toBeVisible();
  await page.getByRole('button', { name: 'DÉCONNEXION', exact: true }).click();
  await expect(page.getByRole('link', { name: 'CONNEXION', exact: true })).toBeVisible();
  await expect.poll(() => api.requests.filter(({ path }) => path === '/api/auth/logout').length).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem('shifu.session'))).toBeNull();
});

test('l’inscription valide le mot de passe avant de contacter l’API', async ({ page, api }) => {
  await page.goto('/register');
  await page.getByLabel('PSEUDO', { exact: true }).fill('NouveauJoueur');
  await page.getByLabel('MOT DE PASSE', { exact: true }).fill('court');
  await page.getByRole('button', { name: 'CRÉER MON COMPTE', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('12 caractères');
  expect(api.requests.filter(({ path }) => path === '/api/auth/register')).toHaveLength(0);
  await page.getByLabel('MOT DE PASSE', { exact: true }).fill('MotDePasse!123');
  await page.getByRole('radio', { name: 'Dragon', exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'CRÉER MON COMPTE', exact: true }).click();
  await expect(page).toHaveURL('/');
  expect(api.requests.find(({ path }) => path === '/api/auth/register')?.body).toEqual({ username: 'NouveauJoueur', password: 'MotDePasse!123', avatar: '🐉' });
});

test('une erreur de connexion reste visible sans créer de session', async ({ page, api }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Identifiants invalides' } } }));
  await page.goto('/login');
  await page.getByLabel('PSEUDO', { exact: true }).fill(api.profile.username);
  await page.getByLabel('MOT DE PASSE', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'ME CONNECTER', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Identifiants invalides');
  expect(await page.evaluate(() => sessionStorage.getItem('shifu.session'))).toBeNull();
});
