import request from 'supertest';
import app from '../../src/app';

describe('validation et protection HTTP', () => {
  it('rejette une inscription invalide avant MongoDB', async () => {
    const response = await request(app).post('/api/auth/register').send({
      username: 'x',
      password: 'short',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
  });
  it('protège le profil sans JWT', async () => {
    const response = await request(app).get('/api/users/me');
    expect(response.status).toBe(401);
  });
});
