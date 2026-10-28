import { errorResponseSchema } from '@shifu/shared';
import mongoose from 'mongoose';
import { testApi } from '../helpers/http';

test("le limiteur d'authentification accepte 20 tentatives puis refuse la 21e avant MongoDB", async () => {
  const api = testApi();
  for (let attempt = 1; attempt <= 21; attempt++) {
    const response = await api
      .post('/api/auth/login')
      .send({})
      .expect(attempt === 21 ? 429 : 400);
    expect(errorResponseSchema.parse(response.body).error.code).toBe(attempt === 21 ? 'RATE_LIMITED' : 'INVALID_INPUT');
  }
  expect(mongoose.connect).not.toHaveBeenCalled();
});
