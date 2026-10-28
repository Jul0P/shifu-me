import { publicUserSchema } from '@shifu/shared';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { transaction } from '../../src/config/database';
import { AuthSessionModel } from '../../src/modules/auth/auth-session.model';
import { GameModel, MatchModel } from '../../src/modules/game/game.model';
import { LeaderboardService } from '../../src/modules/leaderboard/leaderboard.service';
import { LobbyGateModel, ParticipationModel } from '../../src/modules/matchmaking/participation.model';
import { RoomModel } from '../../src/modules/rooms/room.model';
import { UserModel } from '../../src/modules/users/user.model';
import { toPublicUser, UsersService } from '../../src/modules/users/users.service';
import { testSession } from '../helpers/database';

jest.mock('../../src/config/database', () => ({ transaction: jest.fn() }));

test('la suppression du compte refuse un mauvais mot de passe avant toute opération destructive', async () => {
  const user = new UserModel({ username: 'Ninja', passwordHash: await bcrypt.hash('LegacyPassword1!', 4) });
  const query = UserModel.findById(user._id);
  jest.spyOn(query, 'exec').mockImplementation(async () => user);
  jest.spyOn(UserModel, 'findById').mockImplementation(() => query);
  const remove = jest.spyOn(UserModel, 'deleteOne').mockImplementation(() => {
    throw new Error('La suppression ne doit pas être exécutée');
  });

  await expect(new UsersService().deleteAccount(String(user._id), 'wrong-password')).rejects.toMatchObject({ code: 'INVALID_PASSWORD', status: 403 });
  expect(remove.mock.calls.length).toBe(0);
});

test('le profil public exclut le hash du mot de passe et les champs internes', () => {
  const user = new UserModel({
    username: 'Ninja',
    usernameLower: 'ninja',
    passwordHash: 'not-a-real-hash',
  });
  const dto = toPublicUser(user);
  publicUserSchema.parse(dto);
  expect(Object.keys(dto).sort()).toEqual(['avatar', 'elo', 'id', 'stats', 'username']);
  expect(dto.elo).toBe(100);
  expect(dto.stats).toEqual({
    wins: 0,
    losses: 0,
  });
});

test('la mise à jour normalise le pseudo et retourne uniquement les champs publics', async () => {
  const user = new UserModel({
    username: 'NewNinja',
    usernameLower: 'newninja',
    passwordHash: 'not-a-real-hash',
  });
  const query = UserModel.findByIdAndUpdate(user._id, {});
  jest.spyOn(query, 'exec').mockImplementation(async () => user);
  const update = jest.spyOn(UserModel, 'findByIdAndUpdate').mockImplementation(() => query);
  const result = await new UsersService().update(String(user._id), {
    username: 'NewNinja',
  });
  expect(update.mock.calls[0]).toEqual([
    String(user._id),
    {
      $set: {
        username: 'NewNinja',
        usernameLower: 'newninja',
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  ]);
  expect(result.username).toBe('NewNinja');
  expect('passwordHash' in result).toBe(false);
});

test('le classement paginé conserve le tri, les rangs absolus et les taux de victoire', async () => {
  const users = [
    new UserModel({
      username: 'Winner',
      stats: {
        wins: 3,
        losses: 1,
      },
      elo: 200,
    }),
    new UserModel({
      username: 'Newbie',
      stats: {
        wins: 0,
        losses: 0,
      },
      elo: 100,
    }),
  ];
  const query = UserModel.find();
  jest.spyOn(query, 'exec').mockImplementation(async () => users);
  jest.spyOn(UserModel, 'find').mockImplementation(() => query);
  const count = UserModel.countDocuments();
  jest.spyOn(count, 'exec').mockImplementation(async () => 6);
  jest.spyOn(UserModel, 'countDocuments').mockImplementation(() => count);

  const result = await new LeaderboardService().list({
    page: 2,
    limit: 2,
  });
  expect(query.getOptions().sort).toEqual({ elo: -1, 'stats.wins': -1, _id: 1 });
  expect(query.getOptions().skip).toBe(2);
  expect(query.getOptions().limit).toBe(2);
  expect(result.items.map((user) => ({ rank: user.rank, winRate: user.winRate }))).toEqual([
    { rank: 3, winRate: 75 },
    { rank: 4, winRate: 0 },
  ]);
  expect(result.total).toBe(6);
  expect(result.pages).toBe(3);
});

test('la lecture et la modification refusent un compte inexistant', async () => {
  const query = UserModel.findById();
  jest.spyOn(query, 'exec').mockResolvedValue(null);
  jest.spyOn(UserModel, 'findById').mockReturnValue(query);
  const updateQuery = UserModel.findByIdAndUpdate();
  jest.spyOn(updateQuery, 'exec').mockResolvedValue(null);
  jest.spyOn(UserModel, 'findByIdAndUpdate').mockReturnValue(updateQuery);
  const service = new UsersService();
  await expect(service.me('missing')).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
  await expect(service.update('missing', { avatar: '🪨' })).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  await expect(service.deleteAccount('missing', 'ShifuCompte1!')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
});

test.each([true, false])("l'historique présente le score et l'Elo du bon côté (premier joueur : %s)", async (first) => {
  const userId = String(new mongoose.Types.ObjectId());
  const opponentId = String(new mongoose.Types.ObjectId());
  const match = new MatchModel({
    gameId: new mongoose.Types.ObjectId(),
    player1: { id: first ? userId : opponentId, username: 'NinjaOne', avatar: '🪨', elo: 100, stats: { wins: 0, losses: 0 } },
    player2: { id: first ? opponentId : userId, username: 'NinjaTwo', avatar: '🪨', elo: 100, stats: { wins: 0, losses: 0 } },
    winnerId: first ? userId : opponentId,
    score: { player1: 3, player2: 1 },
    eloBefore: { player1: 100, player2: 100 },
    eloAfter: { player1: 110, player2: 90 },
    eloDelta: { player1: 10, player2: -10 },
    finishedAt: new Date('2026-10-27T12:00:00.000Z'),
  }).toObject();
  const query = MatchModel.find();
  jest.spyOn(query.lean(), 'exec').mockResolvedValue([match]);
  jest.spyOn(MatchModel, 'find').mockReturnValue(query);
  const count = MatchModel.countDocuments();
  jest.spyOn(count, 'exec').mockResolvedValue(3);
  jest.spyOn(MatchModel, 'countDocuments').mockReturnValue(count);
  const result = await new UsersService().history(userId, { page: 2, limit: 1 });
  expect(result.items[0]).toMatchObject({
    opponent: { id: opponentId },
    myScore: first ? 3 : 1,
    opponentScore: first ? 1 : 3,
    won: first,
    eloDelta: first ? 10 : -10,
    eloBefore: 100,
    eloAfter: first ? 110 : 90,
    finishedAt: match.finishedAt.toISOString(),
  });
  expect(MatchModel.find).toHaveBeenCalledWith({ $or: [{ 'player1.id': userId }, { 'player2.id': userId }] });
  expect(query.getOptions()).toMatchObject({ sort: { finishedAt: -1, _id: -1 }, skip: 1, limit: 1 });
  expect(result.pages).toBe(3);
});

test.each([true, false])('la suppression est refusée en partie active : %s, sinon elle nettoie les données sous transaction', async (active) => {
  const session = testSession();
  jest.mocked(transaction).mockImplementation(async (work) => work(session));
  const user = new UserModel({ username: 'Ninja', passwordHash: await bcrypt.hash('ShifuCompte1!', 4) });
  const id = String(user._id);
  const userQuery = UserModel.findById();
  jest.spyOn(userQuery, 'exec').mockResolvedValue(user);
  jest.spyOn(UserModel, 'findById').mockReturnValue(userQuery);
  const gate = LobbyGateModel.updateOne({}, {});
  jest.spyOn(gate, 'exec').mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
  const lock = jest.spyOn(LobbyGateModel, 'updateOne').mockReturnValue(gate);
  const existsQuery = UserModel.exists({});
  jest.spyOn(existsQuery, 'exec').mockResolvedValue({ _id: user._id });
  jest.spyOn(UserModel, 'exists').mockReturnValue(existsQuery);
  const gameQuery = GameModel.exists({});
  jest.spyOn(gameQuery, 'exec').mockResolvedValue(active ? { _id: new mongoose.Types.ObjectId() } : null);
  jest.spyOn(GameModel, 'exists').mockReturnValue(gameQuery);
  const gameUpdate = GameModel.updateMany({}, {});
  jest.spyOn(gameUpdate, 'exec').mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
  const anonymizeGames = jest.spyOn(GameModel, 'updateMany').mockReturnValue(gameUpdate);
  const matchUpdate = MatchModel.updateMany({}, {});
  jest.spyOn(matchUpdate, 'exec').mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
  const anonymizeMatches = jest.spyOn(MatchModel, 'updateMany').mockReturnValue(matchUpdate);
  const roomsQuery = RoomModel.deleteMany({});
  jest.spyOn(roomsQuery, 'exec').mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  const rooms = jest.spyOn(RoomModel, 'deleteMany').mockReturnValue(roomsQuery);
  const participationQuery = ParticipationModel.deleteOne();
  jest.spyOn(participationQuery, 'exec').mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  const participations = jest.spyOn(ParticipationModel, 'deleteOne').mockReturnValue(participationQuery);
  const sessionsQuery = AuthSessionModel.deleteMany({});
  jest.spyOn(sessionsQuery, 'exec').mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  const sessions = jest.spyOn(AuthSessionModel, 'deleteMany').mockReturnValue(sessionsQuery);
  const removeQuery = UserModel.deleteOne();
  jest.spyOn(removeQuery, 'exec').mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  const remove = jest.spyOn(UserModel, 'deleteOne').mockReturnValue(removeQuery);

  const operation = new UsersService().deleteAccount(id, 'ShifuCompte1!');
  if (active) {
    await expect(operation).rejects.toMatchObject({ status: 409, code: 'ACTIVE_GAME' });
    expect(anonymizeGames).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(sessions).not.toHaveBeenCalled();
    expect(rooms).not.toHaveBeenCalled();
    expect(participations).not.toHaveBeenCalled();
  } else {
    await expect(operation).resolves.toBeUndefined();
    for (const side of ['player1', 'player2']) {
      const filter = { [`${side}.id`]: id };
      const update = { $set: { [`${side}.username`]: 'Compte supprimé', [`${side}.avatar`]: '👤' } };
      expect(anonymizeGames).toHaveBeenCalledWith(filter, update, { session });
      expect(anonymizeMatches).toHaveBeenCalledWith(filter, update, { session });
    }
    expect(rooms).toHaveBeenCalledWith({ $or: [{ hostId: id }, { guestId: id }] }, { session });
    expect(participations).toHaveBeenCalledWith({ _id: id }, { session });
    expect(sessions).toHaveBeenCalledWith({ userId: id }, { session });
    expect(remove).toHaveBeenCalledWith({ _id: id }, { session });
  }
  expect(lock).toHaveBeenCalledWith({ _id: 'lobby' }, { $inc: { version: 1 } }, { session });
});
