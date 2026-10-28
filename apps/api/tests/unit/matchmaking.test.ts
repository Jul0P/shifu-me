import { GAME_CONFIG, lobbyResponseSchema } from '@shifu/shared';
import mongoose from 'mongoose';
import { transaction } from '../../src/config/database';
import { GameModel } from '../../src/modules/game/game.model';
import { GameService } from '../../src/modules/game/game.service';
import { MatchmakingService } from '../../src/modules/matchmaking/matchmaking.service';
import { LobbyGateModel, ParticipationModel } from '../../src/modules/matchmaking/participation.model';
import { RoomModel } from '../../src/modules/rooms/room.model';
import { UserModel } from '../../src/modules/users/user.model';
import { testSession } from '../helpers/database';

jest.mock('../../src/config/database', () => ({ transaction: jest.fn() }));

const userId = 'abcdef0123456789abcdef01';
const opponentId = 'abcdef0123456789abcdef02';
const now = new Date('2026-10-27T12:00:00.000Z');

beforeEach(() => {
  jest.useFakeTimers({ now });
});
afterEach(() => {
  jest.useRealTimers();
});

function fixture() {
  const session = testSession();
  jest.mocked(transaction).mockImplementation(async (work) => work(session));
  const gate = LobbyGateModel.updateOne({}, {});
  jest.spyOn(gate, 'exec').mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
  jest.spyOn(LobbyGateModel, 'updateOne').mockReturnValue(gate);
  const user = UserModel.exists({});
  const exists = jest.spyOn(user, 'exec').mockResolvedValue({ _id: new mongoose.Types.ObjectId(userId) });
  jest.spyOn(UserModel, 'exists').mockReturnValue(user);
  const cleanup = ParticipationModel.deleteMany({});
  jest.spyOn(cleanup, 'exec').mockResolvedValue({ acknowledged: true, deletedCount: 0 });
  const cleanupParticipations = jest.spyOn(ParticipationModel, 'deleteMany').mockReturnValue(cleanup);
  const cleanupRooms = RoomModel.deleteMany({});
  jest.spyOn(cleanupRooms, 'exec').mockResolvedValue({ acknowledged: true, deletedCount: 0 });
  jest.spyOn(RoomModel, 'deleteMany').mockReturnValue(cleanupRooms);
  const participation = new ParticipationModel({
    _id: userId,
    mode: 'QUEUE',
    joinedAt: now,
    expiresAt: new Date(now.getTime() + GAME_CONFIG.QUEUE_LEASE_MS),
  });
  const save = jest.spyOn(participation, 'save').mockResolvedValue(participation);
  const currentQuery = ParticipationModel.findById(userId);
  const current = jest.spyOn(currentQuery, 'exec').mockResolvedValue(null);
  jest.spyOn(ParticipationModel, 'findById').mockReturnValue(currentQuery);
  const opponentQuery = ParticipationModel.findOne();
  const opponent = jest.spyOn(opponentQuery, 'exec').mockResolvedValue(null);
  jest.spyOn(ParticipationModel, 'findOne').mockReturnValue(opponentQuery);
  const create = jest.spyOn(ParticipationModel, 'create').mockResolvedValue([participation]);
  const games = new GameService();
  const game = new GameModel({ _id: new mongoose.Types.ObjectId() });
  const createGame = jest.spyOn(games, 'create').mockResolvedValue(game);
  const room = new RoomModel({ code: 'AB23', hostId: opponentId, expiresAt: new Date(now.getTime() + GAME_CONFIG.ROOM_TTL_MS) });
  const roomQuery = RoomModel.findOne();
  const findRoom = jest.spyOn(roomQuery, 'exec').mockResolvedValue(room);
  jest.spyOn(RoomModel, 'findOne').mockReturnValue(roomQuery);
  const roomSave = jest.spyOn(room, 'save').mockResolvedValue(room);
  return { session, exists, cleanupParticipations, participation, save, current, opponent, opponentQuery, create, games, game, createGame, room, findRoom, roomSave, service: new MatchmakingService(games) };
}

test('consulter une file vide reste idle sans inscrire le joueur', async () => {
  const f = fixture();
  await expect(f.service.queue(userId, false)).resolves.toEqual({ status: 'idle' });
  expect(f.create).not.toHaveBeenCalled();
  expect(f.createGame).not.toHaveBeenCalled();
  expect(f.cleanupParticipations).toHaveBeenCalledWith({ mode: { $in: ['QUEUE', 'ROOM'] }, expiresAt: { $lte: now } }, { session: f.session });
});

test('rejoindre une file vide crée une réservation de 30 secondes et reste en recherche', async () => {
  const f = fixture();
  const result = lobbyResponseSchema.parse(await f.service.queue(userId, true));
  expect(result).toEqual({ status: 'searching', joinedAt: now.toISOString(), expiresAt: new Date(now.getTime() + GAME_CONFIG.QUEUE_LEASE_MS).toISOString() });
  expect(f.create).toHaveBeenCalledWith([{ _id: userId, mode: 'QUEUE', joinedAt: now, expiresAt: f.participation.expiresAt }], { session: f.session });
  expect(f.save).toHaveBeenCalledWith({ session: f.session });
});

test('un nouveau join renouvelle la réservation existante sans en créer une seconde', async () => {
  const f = fixture();
  f.participation.expiresAt = new Date(now.getTime() + 1);
  f.current.mockResolvedValue(f.participation);
  await f.service.queue(userId, true);
  expect(f.create).not.toHaveBeenCalled();
  expect(f.participation.expiresAt?.getTime()).toBe(now.getTime() + GAME_CONFIG.QUEUE_LEASE_MS);
});

test('un adversaire disponible déclenche une seule création de partie dans la transaction du lobby', async () => {
  const f = fixture();
  f.opponent.mockResolvedValue(new ParticipationModel({ _id: opponentId, mode: 'QUEUE' }));
  await expect(f.service.queue(userId, true)).resolves.toEqual({ status: 'matched', gameId: String(f.game._id) });
  expect(f.createGame).toHaveBeenCalledTimes(1);
  expect(f.createGame).toHaveBeenCalledWith(opponentId, userId, null, f.session);
  expect(ParticipationModel.findOne).toHaveBeenCalledWith({ _id: { $ne: userId }, mode: 'QUEUE', expiresAt: { $gt: now } });
  expect(f.opponentQuery.getOptions().sort).toEqual({ joinedAt: 1, _id: 1 });
});

test('un compte supprimé est refusé sous le verrou du lobby avant toute réservation', async () => {
  const f = fixture();
  f.exists.mockResolvedValue(null);
  await expect(f.service.queue(userId, true)).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  expect(f.create).not.toHaveBeenCalled();
});

test('quitter la file supprime uniquement sa réservation QUEUE', async () => {
  const f = fixture();
  f.current.mockResolvedValue(f.participation);
  const query = ParticipationModel.deleteOne();
  jest.spyOn(query, 'exec').mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  const remove = jest.spyOn(ParticipationModel, 'deleteOne').mockReturnValue(query);
  await expect(f.service.leave(userId)).resolves.toEqual({ status: 'idle' });
  expect(remove).toHaveBeenCalledWith({ _id: userId, mode: 'QUEUE' }, { session: f.session });
});

test('quitter après appariement conserve la partie au lieu de libérer le joueur', async () => {
  const f = fixture();
  f.participation.mode = 'GAME';
  f.participation.gameId = f.game._id;
  f.current.mockResolvedValue(f.participation);
  jest.spyOn(f.games, 'findForPlayer').mockResolvedValue(f.game);
  jest.spyOn(f.games, 'advance').mockResolvedValue(f.game);
  const remove = jest.spyOn(ParticipationModel, 'deleteOne');
  await expect(f.service.leave(userId)).resolves.toEqual({ status: 'matched', gameId: String(f.game._id) });
  expect(remove).not.toHaveBeenCalled();
});

test('la création de salle produit un code valide et une réservation avec la même expiration', async () => {
  const f = fixture();
  const query = RoomModel.exists({});
  jest.spyOn(query, 'exec').mockResolvedValue(null);
  jest.spyOn(RoomModel, 'exists').mockReturnValue(query);
  const createRoom = jest.spyOn(RoomModel, 'create').mockResolvedValue([f.room]);
  const result = lobbyResponseSchema.parse(await f.service.createRoom(userId));
  expect(result).toEqual({ status: 'waiting', code: expect.stringMatching(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/), expiresAt: new Date(now.getTime() + GAME_CONFIG.ROOM_TTL_MS).toISOString() });
  expect(createRoom).toHaveBeenCalledWith([expect.objectContaining({ hostId: userId, expiresAt: new Date(now.getTime() + GAME_CONFIG.ROOM_TTL_MS) })], { session: f.session });
  expect(f.create).toHaveBeenCalledWith([expect.objectContaining({ _id: userId, mode: 'ROOM' })], { session: f.session });
});

test('un joueur en recherche doit quitter la file avant de créer une salle', async () => {
  const f = fixture();
  f.current.mockResolvedValue(f.participation);
  await expect(f.service.createRoom(userId)).rejects.toMatchObject({ code: 'ALREADY_SEARCHING' });
});

test('rejoindre une salle disponible crée une partie privée puis mémorise son invité', async () => {
  const f = fixture();
  f.opponent.mockResolvedValue(new ParticipationModel({ _id: opponentId, mode: 'ROOM', roomCode: 'AB23' }));
  await expect(f.service.joinRoom(userId, 'AB23')).resolves.toEqual({ status: 'matched', gameId: String(f.game._id) });
  expect(f.createGame).toHaveBeenCalledTimes(1);
  expect(f.createGame).toHaveBeenCalledWith(opponentId, userId, 'AB23', f.session);
  expect(f.room.guestId).toBe(userId);
  expect(f.room.gameId).toEqual(f.game._id);
  expect(f.roomSave).toHaveBeenCalledWith({ session: f.session });
});

test('une salle absente ou expirée renvoie ROOM_NOT_FOUND', async () => {
  const f = fixture();
  f.findRoom.mockResolvedValue(null);
  await expect(f.service.joinRoom(userId, 'AB23')).rejects.toMatchObject({ status: 404, code: 'ROOM_NOT_FOUND' });
});

test('le créateur reste en attente quand il rejoint sa propre salle', async () => {
  const f = fixture();
  f.room.hostId = userId;
  await expect(f.service.joinRoom(userId, 'AB23')).resolves.toMatchObject({ status: 'waiting', code: 'AB23' });
  expect(f.createGame).not.toHaveBeenCalled();
});

test('une salle déjà appariée refuse un tiers mais permet la reconnexion de son invité', async () => {
  const f = fixture();
  f.room.gameId = f.game._id;
  await expect(f.service.joinRoom(userId, 'AB23')).rejects.toMatchObject({ code: 'ROOM_FULL' });
  f.room.guestId = userId;
  await expect(f.service.joinRoom(userId, 'AB23')).resolves.toEqual({ status: 'matched', gameId: String(f.game._id) });
  expect(f.createGame).not.toHaveBeenCalled();
});

test('un joueur déjà occupé ne peut pas rejoindre une autre salle', async () => {
  const f = fixture();
  f.current.mockResolvedValue(f.participation);
  await expect(f.service.joinRoom(userId, 'AB23')).rejects.toMatchObject({ code: 'PLAYER_BUSY' });
  expect(f.createGame).not.toHaveBeenCalled();
});

test('le polling de salle est réservé aux membres et ne crée jamais de partie', async () => {
  const f = fixture();
  await expect(f.service.roomStatus(userId, 'AB23')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  f.room.hostId = userId;
  await expect(f.service.roomStatus(userId, 'AB23')).resolves.toMatchObject({ status: 'waiting', code: 'AB23' });
  f.room.gameId = f.game._id;
  await expect(f.service.roomStatus(userId, 'AB23')).resolves.toEqual({ status: 'matched', gameId: String(f.game._id) });
  expect(f.createGame).not.toHaveBeenCalled();
});

test('seul le créateur peut fermer une salle et une partie déjà créée reste valide', async () => {
  const f = fixture();
  await expect(f.service.deleteRoom(userId, 'AB23')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  f.room.hostId = userId;
  f.room.gameId = f.game._id;
  const remove = jest.spyOn(RoomModel, 'deleteOne');
  await expect(f.service.deleteRoom(userId, 'AB23')).resolves.toEqual({ status: 'matched', gameId: String(f.game._id) });
  expect(remove).not.toHaveBeenCalled();
});

test('fermer une salle en attente retire la salle et sa réservation puis retourne idle', async () => {
  const f = fixture();
  f.room.hostId = userId;
  const roomQuery = RoomModel.deleteOne();
  jest.spyOn(roomQuery, 'exec').mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  const removeRoom = jest.spyOn(RoomModel, 'deleteOne').mockReturnValue(roomQuery);
  const participationQuery = ParticipationModel.deleteOne();
  jest.spyOn(participationQuery, 'exec').mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  const removeParticipation = jest.spyOn(ParticipationModel, 'deleteOne').mockReturnValue(participationQuery);
  await expect(f.service.deleteRoom(userId, 'AB23')).resolves.toEqual({ status: 'idle' });
  expect(removeRoom).toHaveBeenCalledWith({ _id: f.room._id }, { session: f.session });
  expect(removeParticipation).toHaveBeenCalledWith({ _id: userId, mode: 'ROOM', roomCode: 'AB23' }, { session: f.session });
});
