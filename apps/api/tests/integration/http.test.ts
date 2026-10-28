import { AVATARS, configResponseSchema, errorResponseSchema, GAME_CONFIG, healthResponseSchema } from '@shifu/shared';
import { testApi } from '../helpers/http';

test('la santé reste indépendante de MongoDB avec les en-têtes de sécurité et de cache', async () => {
  const response = await testApi().get('/api/health').expect(200);
  expect(healthResponseSchema.parse(response.body)).toEqual({ status: 'ok' });
  expect(response.headers['x-powered-by']).toBeUndefined();
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['content-security-policy']).toBeDefined();
});

test('la configuration expose les constantes et les avatars partagés', async () => {
  const response = await testApi().get('/api/config').expect(200);
  const config = configResponseSchema.parse(response.body);
  expect(config).toEqual({
    avatars: [...AVATARS],
    roundDurationMs: GAME_CONFIG.ROUND_DURATION_MS,
    revealDurationMs: GAME_CONFIG.ROUND_REVEAL_MS,
    winsToVictory: GAME_CONFIG.WINS_TO_VICTORY,
    matchmakingPollMs: GAME_CONFIG.MATCHMAKING_POLL_MS,
    gamePollMs: GAME_CONFIG.GAME_POLL_MS,
  });
});

test.each([
  ['get', '/api/missing', undefined, 404, 'NOT_FOUND'],
  ['post', '/api/auth/register', '{}', 400, 'INVALID_INPUT'],
  ['post', '/api/auth/login', '{', 400, 'INVALID_INPUT'],
  ['post', '/api/auth/login', JSON.stringify({ username: 'x'.repeat(17_000) }), 413, 'PAYLOAD_TOO_LARGE'],
  ['get', '/api/users/leaderboard?limit=51', undefined, 400, 'INVALID_INPUT'],
  ['get', '/api/users/leaderboard?page=0', undefined, 400, 'INVALID_INPUT'],
  ['get', '/api/users/leaderboard?unknown=1', undefined, 400, 'INVALID_INPUT'],
  ['get', '/api/ready', undefined, 503, 'DATABASE_UNAVAILABLE'],
  ['get', '/api/users/leaderboard?limit=3', undefined, 503, 'DATABASE_UNAVAILABLE'],
  ['post', '/api/auth/login', JSON.stringify({ username: 'Ninja', password: 'valid-password' }), 503, 'DATABASE_UNAVAILABLE'],
] as const)('%s %s (cas %#) respecte le statut HTTP et le code attendus', async (method, path, body, status, code) => {
  const response = await testApi()[method](path).set('Content-Type', 'application/json').send(body).expect(status);
  expect(errorResponseSchema.parse(response.body).error.code).toBe(code);
  expect(response.body.error).not.toHaveProperty('stack');
  expect(response.headers['cache-control']).toBe('no-store');
});

test('un encodage JSON non pris en charge renvoie une erreur client structurée plutôt qu’une erreur serveur', async () => {
  const response = await testApi().post('/api/auth/login').set('Content-Type', 'application/json; charset=iso-8859-1').send('{}').expect(415);
  expect(errorResponseSchema.parse(response.body).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  expect(response.headers['cache-control']).toBe('no-store');
});

test('CORS autorise le frontend configuré à soumettre une action authentifiée', async () => {
  const response = await testApi().options('/api/game/abcdef0123456789abcdef01/action').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'authorization,content-type').expect(204);
  expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  expect(response.headers['access-control-allow-methods']).toMatch(/POST/);
  expect(response.headers['access-control-allow-headers']).toMatch(/authorization/i);
});
