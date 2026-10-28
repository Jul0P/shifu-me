import { errorResponseSchema } from '@shifu/shared';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { AuthService } from '../../src/modules/auth/auth.service';
import { testApi } from '../helpers/http';

const id = 'abcdef0123456789abcdef01';
const privateRoutes = [
  ['post', '/api/auth/logout'],
  ['get', '/api/users/me'],
  ['put', '/api/users/me'],
  ['delete', '/api/users/me'],
  ['get', '/api/users/me/history'],
  ['post', '/api/matchmaking/join'],
  ['get', '/api/matchmaking/status'],
  ['delete', '/api/matchmaking/leave'],
  ['post', '/api/rooms'],
  ['get', '/api/rooms/AB23'],
  ['post', '/api/rooms/AB23/join'],
  ['delete', '/api/rooms/AB23'],
  ['get', `/api/game/${id}/poll`],
  ['post', `/api/game/${id}/action`],
  ['post', `/api/game/${id}/resolve`],
  ['get', `/api/game/${id}/rounds`],
] as const;

test.each(privateRoutes)('%s %s exige une authentification avant tout accès aux données', async (method, path) => {
  const response = await testApi()[method](path).expect(401);
  expect(errorResponseSchema.parse(response.body).error.code).toBe('UNAUTHORIZED');
  expect(mongoose.connect).not.toHaveBeenCalled();
});

test('un jeton malformé est refusé sans interroger MongoDB', async () => {
  const response = await testApi().get('/api/users/me').set('Authorization', 'Bearer invalid').expect(401);
  expect(errorResponseSchema.parse(response.body).error.code).toBe('UNAUTHORIZED');
  expect(mongoose.connect).not.toHaveBeenCalled();
});

test('une signature JWT valide ne suffit pas sans session persistée', async () => {
  const token = jwt.sign({}, process.env.JWT_SECRET ?? '', {
    subject: id,
    jwtid: 'test-session',
    expiresIn: '1h',
    issuer: 'shifu-api',
    audience: 'shifu-web',
    algorithm: 'HS256',
  });
  const response = await testApi().get('/api/users/me').auth(token, { type: 'bearer' }).expect(503);
  expect(errorResponseSchema.parse(response.body).error.code).toBe('DATABASE_UNAVAILABLE');
});

describe('validation HTTP après authentification simulée', () => {
  let token: string;

  beforeEach(() => {
    process.env.MONGODB_URI = 'mongodb://never-connected.invalid/unused';
    jest.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    jest.spyOn(AuthService.prototype, 'active').mockResolvedValue(undefined);
    token = jwt.sign({}, process.env.JWT_SECRET ?? '', {
      subject: id,
      jwtid: 'test-session',
      expiresIn: '1h',
      issuer: 'shifu-api',
      audience: 'shifu-web',
    });
  });

  test.each([
    ['put', '/api/users/me', {}],
    ['delete', '/api/users/me', {}],
    ['delete', '/api/users/me', { password: 'legacy-password', userId: id }],
    ['put', '/api/users/me', { elo: 9000 }],
    ['post', `/api/game/${id}/action`, { move: 'rock' }],
    ['post', `/api/game/${id}/action`, { roundId: id, move: 'lizard' }],
    ['post', `/api/game/${id}/action`, { roundId: id, move: 'rock', playerId: id }],
    ['get', '/api/game/invalid/poll', undefined],
    ['get', `/api/game/${id}/rounds?limit=51`, undefined],
    ['get', '/api/rooms/AB01', undefined],
  ] as const)('%s %s refuse le corps ou les paramètres invalides : %j', async (method, path, body) => {
    const response = await testApi()[method](path).auth(token, { type: 'bearer' }).send(body).expect(400);
    expect(errorResponseSchema.parse(response.body).error.code).toBe('INVALID_INPUT');
    expect(AuthService.prototype.active).toHaveBeenCalledWith(id, 'test-session');
  });
});
