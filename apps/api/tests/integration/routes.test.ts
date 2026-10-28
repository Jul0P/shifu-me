import { authResponseSchema, gameResponseSchema } from '@shifu/shared';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { ApiError } from '../../src/lib/api-error';
import { AuthService } from '../../src/modules/auth/auth.service';
import { GameModel } from '../../src/modules/game/game.model';
import { GameService } from '../../src/modules/game/game.service';
import { LeaderboardService } from '../../src/modules/leaderboard/leaderboard.service';
import { MatchmakingService } from '../../src/modules/matchmaking/matchmaking.service';
import { UserModel } from '../../src/modules/users/user.model';
import { toPublicUser, UsersService } from '../../src/modules/users/users.service';
import { testApi } from '../helpers/http';

jest.mock('../../src/config/models', () => ({ initializeDatabase: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/config/database', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));

const userId = 'abcdef0123456789abcdef01';
const gameId = 'abcdef0123456789abcdef02';
const roundId = 'abcdef0123456789abcdef03';
const user = toPublicUser(new UserModel({ _id: userId, username: 'Ninja' }));
let token: string;

beforeEach(() => {
  token = jwt.sign({}, process.env.JWT_SECRET ?? '', {
    subject: userId,
    jwtid: 'session-id',
    issuer: 'shifu-api',
    audience: 'shifu-web',
    expiresIn: '1h',
  });
  jest.spyOn(AuthService.prototype, 'active').mockResolvedValue(undefined);
});

test.each(['register', 'login'] as const)('POST /auth/%s valide les identifiants et renvoie la réponse du service', async (action) => {
  const credentials = { token, user, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
  const service = jest.spyOn(AuthService.prototype, action).mockResolvedValue(credentials);
  const response = await testApi()
    .post(`/api/auth/${action}`)
    .send({ username: ' Ninja ', password: 'ShifuCompte1!' })
    .expect(action === 'register' ? 201 : 200);
  expect(authResponseSchema.parse(response.body)).toEqual(credentials);
  expect(service).toHaveBeenCalledWith({ username: 'Ninja', password: 'ShifuCompte1!' });
});

test('la déconnexion transmet les identifiants du JWT au service et renvoie 204', async () => {
  const service = jest.spyOn(AuthService.prototype, 'logout').mockResolvedValue(undefined);
  await testApi().post('/api/auth/logout').auth(token, { type: 'bearer' }).expect(204);
  expect(service).toHaveBeenCalledWith(userId, 'session-id');
});

test('un JWT dont la session est révoquée reste refusé même si sa signature est valide', async () => {
  jest.spyOn(AuthService.prototype, 'active').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Session révoquée'));
  const service = jest.spyOn(UsersService.prototype, 'me');
  await testApi().get('/api/users/me').auth(token, { type: 'bearer' }).expect(401);
  expect(service).not.toHaveBeenCalled();
});

test('le profil lu et modifié utilise uniquement le joueur authentifié', async () => {
  const me = jest.spyOn(UsersService.prototype, 'me').mockResolvedValue(user);
  const update = jest.spyOn(UsersService.prototype, 'update').mockResolvedValue(user);
  const response = await testApi().get('/api/users/me').auth(token, { type: 'bearer' }).expect(200);
  expect(response.body).toEqual(user);
  expect(me).toHaveBeenCalledWith(userId);
  await testApi().put('/api/users/me').auth(token, { type: 'bearer' }).send({ username: 'Ninja' }).expect(200);
  expect(update).toHaveBeenCalledWith(userId, { username: 'Ninja' });
});

test('la suppression transmet le mot de passe et répond sans corps après succès', async () => {
  const remove = jest.spyOn(UsersService.prototype, 'deleteAccount').mockResolvedValue(undefined);
  const response = await testApi().delete('/api/users/me').auth(token, { type: 'bearer' }).send({ password: 'ShifuCompte1!' }).expect(204);
  expect(response.text).toBe('');
  expect(remove).toHaveBeenCalledWith(userId, 'ShifuCompte1!');
});

test("l'historique et le classement transmettent une pagination validée", async () => {
  const page = { items: [], page: 2, limit: 3, total: 0, pages: 1 };
  const history = jest.spyOn(UsersService.prototype, 'history').mockResolvedValue(page);
  const board = jest.spyOn(LeaderboardService.prototype, 'list').mockResolvedValue(page);
  const response = await testApi().get('/api/users/me/history?page=2&limit=3').auth(token, { type: 'bearer' }).expect(200);
  expect(response.body).toEqual(page);
  expect(history).toHaveBeenCalledWith(userId, { page: 2, limit: 3 });
  await testApi().get('/api/users/leaderboard?page=2&limit=3').expect(200);
  expect(board).toHaveBeenCalledWith({ page: 2, limit: 3 });
});

test('le parcours HTTP du matchmaking rejoint, consulte puis quitte la file', async () => {
  const queue = jest.spyOn(MatchmakingService.prototype, 'queue').mockResolvedValue({ status: 'idle' });
  const leave = jest.spyOn(MatchmakingService.prototype, 'leave').mockResolvedValue({ status: 'idle' });
  await testApi().post('/api/matchmaking/join').auth(token, { type: 'bearer' }).expect(200);
  expect(queue).toHaveBeenLastCalledWith(userId, true);
  await testApi().get('/api/matchmaking/status').auth(token, { type: 'bearer' }).expect(200);
  expect(queue).toHaveBeenLastCalledWith(userId, false);
  await testApi().delete('/api/matchmaking/leave').auth(token, { type: 'bearer' }).expect(200);
  expect(leave).toHaveBeenCalledWith(userId);
});

test('les routes de salle transmettent un code normalisé et le joueur authentifié', async () => {
  const create = jest.spyOn(MatchmakingService.prototype, 'createRoom').mockResolvedValue({ status: 'idle' });
  const join = jest.spyOn(MatchmakingService.prototype, 'joinRoom').mockResolvedValue({ status: 'idle' });
  const status = jest.spyOn(MatchmakingService.prototype, 'roomStatus').mockResolvedValue({ status: 'idle' });
  const leave = jest.spyOn(MatchmakingService.prototype, 'deleteRoom').mockResolvedValue({ status: 'idle' });
  await testApi().post('/api/rooms').auth(token, { type: 'bearer' }).expect(200);
  expect(create).toHaveBeenCalledWith(userId);
  await testApi().post('/api/rooms/ab23/join').auth(token, { type: 'bearer' }).expect(200);
  expect(join).toHaveBeenCalledWith(userId, 'AB23');
  await testApi().get('/api/rooms/ab23').auth(token, { type: 'bearer' }).expect(200);
  expect(status).toHaveBeenCalledWith(userId, 'AB23');
  await testApi().delete('/api/rooms/ab23').auth(token, { type: 'bearer' }).expect(200);
  expect(leave).toHaveBeenCalledWith(userId, 'AB23');
});

test('polling, soumission, résolution et lecture des manches utilisent les bons identifiants', async () => {
  const now = new Date();
  const game = new GameModel({
    _id: gameId,
    roundId: new mongoose.Types.ObjectId(roundId),
    player1: { ...user, lastSeenAt: now },
    player2: { ...user, id: 'abcdef0123456789abcdef04', lastSeenAt: now },
    roundStartsAt: now,
    roundEndsAt: new Date(now.getTime() + 10_000),
    eloAfter: { player1: 100, player2: 100 },
  });
  const body = new GameService().present(game, userId, now);
  const poll = jest.spyOn(GameService.prototype, 'poll').mockResolvedValue(body);
  const action = jest.spyOn(GameService.prototype, 'action').mockResolvedValue(body);
  const rounds = jest.spyOn(GameService.prototype, 'rounds').mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, pages: 1 });
  const response = await testApi().get(`/api/game/${gameId}/poll`).auth(token, { type: 'bearer' }).expect(200);
  gameResponseSchema.parse(response.body);
  expect(response.body.opponent).not.toHaveProperty('move');
  await testApi().post(`/api/game/${gameId}/action`).auth(token, { type: 'bearer' }).send({ roundId, move: 'rock' }).expect(200);
  expect(action).toHaveBeenCalledWith(gameId, userId, roundId, 'rock');
  await testApi().post(`/api/game/${gameId}/resolve`).auth(token, { type: 'bearer' }).expect(200);
  expect(poll).toHaveBeenCalledTimes(2);
  expect(poll).toHaveBeenLastCalledWith(gameId, userId);
  await testApi().get(`/api/game/${gameId}/rounds`).auth(token, { type: 'bearer' }).expect(200);
  expect(rounds).toHaveBeenCalledWith(gameId, userId, { page: 1, limit: 20 });
});

test('une erreur métier du jeu conserve son statut et son code dans la réponse HTTP', async () => {
  jest.spyOn(GameService.prototype, 'action').mockRejectedValue(new ApiError(409, 'MOVE_LOCKED', 'Coup déjà verrouillé'));
  const response = await testApi().post(`/api/game/${gameId}/action`).auth(token, { type: 'bearer' }).send({ roundId, move: 'rock' }).expect(409);
  expect(response.body).toEqual({ error: { code: 'MOVE_LOCKED', message: 'Coup déjà verrouillé' } });
});
