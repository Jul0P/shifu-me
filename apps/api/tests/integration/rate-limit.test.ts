import { errorResponseSchema } from '@shifu/shared';
import { testApi } from '../helpers/http';

test('le limiteur global accepte 120 requêtes par IP puis refuse la 121e', async () => {
  const api = testApi();
  for (let index = 0; index < 120; index++) {
    await api.get('/api/health').expect(200);
  }
  const response = await api.get('/api/health').expect(429);
  expect(errorResponseSchema.parse(response.body).error.code).toBe('RATE_LIMITED');
  expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  expect(response.headers['cache-control']).toBe('no-store');
});
