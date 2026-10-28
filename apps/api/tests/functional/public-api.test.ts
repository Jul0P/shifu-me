import { configResponseSchema, errorResponseSchema, healthResponseSchema } from '@shifu/shared';
import openapi from '../../src/config/openapi';
import { testApi } from '../helpers/http';

test('un nouveau client découvre les règles et Swagger même lorsque MongoDB est indisponible', async () => {
  const api = testApi();
  const health = await api.get('/api/health').expect(200);
  healthResponseSchema.parse(health.body);
  const config = await api.get('/api/config').expect(200);
  const rules = configResponseSchema.parse(config.body);
  expect(rules.roundDurationMs).toBe(10_000);
  expect(rules.winsToVictory).toBe(3);

  const specification = await api.get('/api/openapi.json').expect(200);
  expect(specification.body).toEqual(JSON.parse(JSON.stringify(openapi)));
  expect(openapi.paths['/api/auth/register'].post).toBeDefined();
  expect(openapi.paths['/api/game/{id}/resolve'].post).toBeDefined();
  expect(openapi.paths['/api/game/{id}/result']).toBeUndefined();

  const docs = await api.get('/api/docs/').expect(200);
  expect(docs.text).toMatch(/swagger-ui/);
  const initializer = await api.get('/api/docs/swagger-ui-init.js').expect(200);
  expect(initializer.text).toMatch(/"persistAuthorization": false/);

  const matchmaking = await api.post('/api/matchmaking/join').expect(401);
  expect(errorResponseSchema.parse(matchmaking.body).error.code).toBe('UNAUTHORIZED');
  const readiness = await api.get('/api/ready').expect(503);
  expect(errorResponseSchema.parse(readiness.body).error.code).toBe('DATABASE_UNAVAILABLE');
  const stillAlive = await api.get('/api/health').expect(200);
  healthResponseSchema.parse(stillAlive.body);
});
