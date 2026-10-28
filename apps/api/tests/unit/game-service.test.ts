import { GAME_CONFIG, gameResponseSchema } from '@shifu/shared';
import mongoose from 'mongoose';
import { transaction } from '../../src/config/database';

import { GameModel, MatchModel, RoundModel } from '../../src/modules/game/game.model';
import { GameService } from '../../src/modules/game/game.service';
import { ParticipationModel } from '../../src/modules/matchmaking/participation.model';
import { UserModel } from '../../src/modules/users/user.model';
import { toPublicUser } from '../../src/modules/users/users.service';
import { testSession } from '../helpers/database';

jest.mock('../../src/config/database', () => ({ transaction: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-27T12:00:00.000Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

function fixture() {
  const now = new Date('2026-10-27T12:00:00.000Z');
  const session = testSession();
  jest.mocked(transaction).mockImplementation(async (work) => work(session));
  const users = [
    new UserModel({
      username: 'NinjaOne',
      usernameLower: 'ninjaone',
      passwordHash: 'not-a-real-hash',
    }),
    new UserModel({
      username: 'NinjaTwo',
      usernameLower: 'ninjatwo',
      passwordHash: 'not-a-real-hash',
    }),
  ];
  const userSaves = users.map((user) => jest.spyOn(user, 'save').mockImplementation(async () => user));
  const game = new GameModel({
    player1: {
      ...toPublicUser(users[0]),
      lastSeenAt: now,
    },
    player2: {
      ...toPublicUser(users[1]),
      lastSeenAt: now,
    },
    roundId: new mongoose.Types.ObjectId(),
    roundStartsAt: new Date(now.getTime() - GAME_CONFIG.ROUND_DURATION_MS),
    roundEndsAt: now,
    eloAfter: {
      player1: 100,
      player2: 100,
    },
  });
  const save = jest.spyOn(game, 'save').mockImplementation(async () => game);
  const rounds = jest.spyOn(RoundModel, 'create').mockImplementation(async () => []);
  const matches = jest.spyOn(MatchModel, 'create').mockImplementation(async () => []);
  const releaseQuery = ParticipationModel.deleteMany({});
  jest.spyOn(releaseQuery, 'exec').mockResolvedValue({
    acknowledged: true,
    deletedCount: 2,
  });
  const releases = jest.spyOn(ParticipationModel, 'deleteMany').mockReturnValue(releaseQuery);
  const findById = UserModel.findById.bind(UserModel);
  jest.spyOn(UserModel, 'findById').mockImplementation((id: string) => {
    const query = findById(id);
    jest.spyOn(query, 'exec').mockImplementation(async () => users.find((user) => String(user._id) === id) ?? null);
    return query;
  });

  return {
    now,
    session,
    users,
    userSaves,
    game,
    save,
    rounds,
    matches,
    releases,
    service: new GameService(),
  };
}

test('une manche ne se résout pas même une milliseconde avant sa deadline', async () => {
  const f = fixture();
  await f.service.advance(f.game, f.session, new Date(f.now.getTime() - 1));
  expect(f.rounds.mock.calls.length).toBe(0);
  expect(f.save.mock.calls.length).toBe(0);
});

for (const outcome of ['victoire', 'égalité', 'forfait simple'] as const) {
  test(`la résolution à la deadline traite ${outcome} et remet le compteur AFK à zéro`, async () => {
    const f = fixture();
    f.game.player1Move = 'rock';
    f.game.player2Move = outcome === 'victoire' ? 'scissors' : outcome === 'égalité' ? 'rock' : null;
    f.game.consecutiveBothAfk = 4;
    const previousRound = String(f.game.roundId);
    await f.service.advance(f.game, f.session, f.now);
    expect(f.game.status).toBe('PLAYING');
    expect(f.game.score.player1).toBe(outcome === 'égalité' ? 0 : 1);
    expect(f.game.score.player2).toBe(0);
    expect(f.game.consecutiveBothAfk).toBe(0);
    expect(f.game.lastResult?.outcome).toBe(outcome === 'égalité' ? 'TIE' : 'PLAYER_1');
    expect(f.game.roundNumber).toBe(2);
    expect(String(f.game.roundId)).not.toBe(previousRound);
    expect(f.game.player1Move).toBe(null);
    expect(f.game.player2Move).toBe(null);
    expect(f.game.roundStartsAt.getTime()).toBe(f.now.getTime() + GAME_CONFIG.ROUND_REVEAL_MS);
    expect(f.game.roundEndsAt.getTime() - f.game.roundStartsAt.getTime()).toBe(10_000);
    expect(f.rounds.mock.calls.length).toBe(1);
    expect(f.matches.mock.calls.length).toBe(0);
    expect(f.save.mock.calls[0]).toEqual([
      {
        session: f.session,
      },
    ]);
  });
}

test('les égalités peuvent dépasser cinq manches sans terminer le match', async () => {
  const f = fixture();
  for (let round = 0; round < 7; round++) {
    f.game.player1Move = 'paper';
    f.game.player2Move = 'paper';
    await f.service.advance(f.game, f.session, f.game.roundEndsAt);
  }
  expect(f.game.roundNumber).toBe(8);
  expect(f.game.status).toBe('PLAYING');
  expect(f.game.score.player1).toBe(0);
  expect(f.game.score.player2).toBe(0);
  expect(f.matches.mock.calls.length).toBe(0);
});

test('cinq doubles absences consécutives annulent sans modifier Elo, statistiques ou historique', async () => {
  const f = fixture();
  for (let round = 1; round <= 5; round++) {
    await f.service.advance(f.game, f.session, f.game.roundEndsAt);
    expect(f.game.status).toBe(round === 5 ? 'CANCELLED' : 'PLAYING');
    expect(f.game.consecutiveBothAfk).toBe(round);
  }
  expect(f.rounds.mock.calls.length).toBe(5);
  expect(f.matches.mock.calls.length).toBe(0);
  expect(f.userSaves.every((save) => save.mock.calls.length === 0)).toBeTruthy();
  expect(f.releases.mock.calls.length).toBe(1);
  expect(f.game.winnerId).toBe(null);
  expect(f.game.eloDelta.player1).toBe(0);
  expect(f.game.eloDelta.player2).toBe(0);
  await f.service.advance(f.game, f.session, new Date(f.now.getTime() + 1_000_000));
  expect(f.rounds.mock.calls.length).toBe(5);
  expect(f.releases.mock.calls.length).toBe(1);
});

test("un polling tardif rattrape les deadlines persistées jusqu'à l'annulation, sans timer", async () => {
  const f = fixture();
  await f.service.advance(f.game, f.session, new Date(f.now.getTime() + 1_000_000));
  expect(f.game.status).toBe('CANCELLED');
  expect(f.rounds.mock.calls.length).toBe(5);
  expect(f.matches.mock.calls.length).toBe(0);
});

for (const winner of [0, 1]) {
  test(`le joueur ${winner + 1} gagne à trois points et la finalisation ne se répète pas`, async () => {
    const f = fixture();
    const side = winner === 0 ? 'player1' : 'player2';
    f.game.score[side] = 2;
    f.game.player1Move = winner === 0 ? 'rock' : 'scissors';
    f.game.player2Move = winner === 0 ? 'scissors' : 'rock';
    f.users[1 - winner].elo = 5;
    await f.service.advance(f.game, f.session, f.now);
    expect(f.game.status).toBe('COMPLETED');
    expect(f.game.winnerId).toBe(String(f.users[winner]._id));
    expect(f.game.score[side]).toBe(3);
    expect(f.users[winner].elo).toBe(110);
    expect(f.users[1 - winner].elo).toBe(0);
    expect(f.users[winner].stats.wins).toBe(1);
    expect(f.users[1 - winner].stats.losses).toBe(1);
    expect(f.matches.mock.calls.length).toBe(1);
    expect(f.releases.mock.calls.length).toBe(1);
    expect(f.userSaves.every((save) => save.mock.calls.length === 1)).toBeTruthy();
    await f.service.advance(f.game, f.session, new Date(f.now.getTime() + 1_000_000));
    expect(f.matches.mock.calls.length).toBe(1);
    expect(f.users[winner].elo).toBe(110);
    gameResponseSchema.parse(f.service.present(f.game, f.game.player1.id, f.now));
  });
}

test("chaque joueur voit son coup mais jamais celui de l'adversaire avant la résolution", async () => {
  const f = fixture();
  f.game.player1Move = 'rock';
  f.game.player2Move = 'scissors';
  for (const [id, move] of [
    [f.game.player1.id, 'rock'],
    [f.game.player2.id, 'scissors'],
  ]) {
    const response = f.service.present(f.game, id, f.now);
    gameResponseSchema.parse(response);
    expect(response.me.move).toBe(move);
    expect('move' in response.opponent).toBe(false);
    expect('player1Move' in response).toBe(false);
    expect('player2Move' in response).toBe(false);
    expect(response.lastResult).toBe(null);
    expect(response.opponent.submitted).toBe(true);
  }
  await f.service.advance(f.game, f.session, f.now);
  const response = f.service.present(f.game, f.game.player1.id, f.now);
  expect(response.phase).toBe('REVEAL');
  expect(response.lastResult?.player1Move).toBe('rock');
  expect(response.lastResult?.player2Move).toBe('scissors');
});

test('un joueur déconnecté conserve son coup déjà soumis', async () => {
  const f = fixture();
  f.game.player1.lastSeenAt = new Date(f.now.getTime() - GAME_CONFIG.PRESENCE_TIMEOUT_MS);
  f.game.player1Move = 'rock';
  expect(f.service.present(f.game, f.game.player1.id, f.now).me.connected).toBe(false);
  await f.service.advance(f.game, f.session, f.now);
  expect(f.game.lastResult?.outcome).toBe('PLAYER_1');
});

test('un joueur ne peut pas créer une partie contre lui-même', async () => {
  const f = fixture();
  await expect(f.service.create(f.game.player1.id, f.game.player1.id, null, f.session)).rejects.toMatchObject({ code: 'SELF_MATCH' });
});

test("la lecture distingue une partie absente d'un accès par un non-participant", async () => {
  const f = fixture();
  const query = GameModel.findById(f.game._id);
  const execute = jest.spyOn(query, 'exec').mockImplementation(async () => f.game);
  jest.spyOn(GameModel, 'findById').mockImplementation(() => query);

  expect(await f.service.findForPlayer(String(f.game._id), f.game.player1.id)).toBe(f.game);
  await expect(f.service.findForPlayer(String(f.game._id), String(new mongoose.Types.ObjectId()))).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  execute.mockImplementation(async () => null);
  await expect(f.service.findForPlayer(String(f.game._id), f.game.player1.id)).rejects.toMatchObject({ status: 404, code: 'GAME_NOT_FOUND' });
});

test.each([
  ['partie terminée', 'COMPLETED', 0, 'GAME_FINISHED'],
  ['manche non commencée', 'PLAYING', -GAME_CONFIG.ROUND_DURATION_MS - 1, 'ROUND_NOT_STARTED'],
  ['deadline atteinte exactement', 'PLAYING', 0, 'ROUND_EXPIRED'],
  ['deadline dépassée', 'PLAYING', 1, 'ROUND_EXPIRED'],
] as const)('la soumission refuse une %s', async (_label, status, offset, code) => {
  const f = fixture();
  f.game.status = status;
  jest.setSystemTime(new Date(f.now.getTime() + offset));
  jest.spyOn(f.service, 'findForPlayer').mockResolvedValue(f.game);
  const write = jest.spyOn(GameModel, 'findOneAndUpdate');
  await expect(f.service.action(String(f.game._id), f.game.player1.id, String(f.game.roundId), 'rock')).rejects.toMatchObject({ status: 409, code });
  expect(write).not.toHaveBeenCalled();
});

test('un identifiant de manche périmé est refusé avant toute écriture', async () => {
  const f = fixture();
  jest.spyOn(f.service, 'findForPlayer').mockResolvedValue(f.game);
  const write = jest.spyOn(GameModel, 'findOneAndUpdate');
  await expect(f.service.action(String(f.game._id), f.game.player1.id, String(new mongoose.Types.ObjectId()), 'rock')).rejects.toMatchObject({ code: 'STALE_ROUND' });
  expect(write).not.toHaveBeenCalled();
});

test.each([0, 1])('le premier coup du joueur %s est accepté une milliseconde avant la deadline puis verrouillé', async (player) => {
  const f = fixture();
  jest.setSystemTime(new Date(f.now.getTime() - 1));
  const side = player === 0 ? 'player1' : 'player2';
  const moveField = player === 0 ? 'player1Move' : 'player2Move';
  jest.spyOn(f.service, 'findForPlayer').mockResolvedValue(f.game);
  const query = GameModel.findOneAndUpdate();
  jest.spyOn(query, 'exec').mockImplementation(async () => {
    f.game[moveField] = 'rock';
    return f.game;
  });
  const write = jest.spyOn(GameModel, 'findOneAndUpdate').mockReturnValue(query);

  const result = await f.service.action(String(f.game._id), f.game[side].id, String(f.game.roundId), 'rock');
  gameResponseSchema.parse(result);
  expect(result.me.move).toBe('rock');
  expect(result.opponent).not.toHaveProperty('move');
  expect(f.rounds).not.toHaveBeenCalled();
  expect(write).toHaveBeenCalledWith(
    {
      _id: f.game._id,
      status: 'PLAYING',
      roundId: f.game.roundId,
      [moveField]: null,
      __v: f.game.__v,
      $expr: { $and: [{ $gt: ['$roundEndsAt', '$$NOW'] }, { $lte: ['$roundStartsAt', '$$NOW'] }] },
    },
    { $set: { [moveField]: 'rock', [`${side}.lastSeenAt`]: new Date() }, $inc: { __v: 1 } },
    { returnDocument: 'after', session: f.session },
  );
  for (const move of ['rock', 'paper'] as const) {
    await expect(f.service.action(String(f.game._id), f.game[side].id, String(f.game.roundId), move)).rejects.toMatchObject({ code: 'MOVE_LOCKED' });
  }
  expect(write).toHaveBeenCalledTimes(1);
});

test('un coup est refusé si la condition atomique MongoDB échoue même après les contrôles du service', async () => {
  const f = fixture();
  jest.setSystemTime(new Date(f.now.getTime() - 1));
  jest.spyOn(f.service, 'findForPlayer').mockResolvedValue(f.game);
  const query = GameModel.findOneAndUpdate();
  jest.spyOn(query, 'exec').mockResolvedValue(null);
  jest.spyOn(GameModel, 'findOneAndUpdate').mockReturnValue(query);
  await expect(f.service.action(String(f.game._id), f.game.player1.id, String(f.game.roundId), 'rock')).rejects.toMatchObject({ code: 'ROUND_EXPIRED' });
  expect(f.rounds).not.toHaveBeenCalled();
});

test('le polling résout une deadline dépassée puis met à jour la présence du joueur', async () => {
  const f = fixture();
  f.game.player1Move = 'paper';
  f.game.player2Move = 'rock';
  jest.spyOn(f.service, 'findForPlayer').mockResolvedValue(f.game);
  const response = await f.service.poll(String(f.game._id), f.game.player2.id);
  expect(response.score).toEqual({ me: 0, opponent: 1 });
  expect(response.phase).toBe('REVEAL');
  expect(response.lastResult?.outcome).toBe('PLAYER_1');
  expect(f.game.player2.lastSeenAt).toEqual(f.now);
  expect(f.save).toHaveBeenCalledWith({ session: f.session });
});

test('la création initialise une manche de dix secondes et réserve les deux joueurs dans la même transaction', async () => {
  const f = fixture();
  const create = jest.spyOn(GameModel, 'create').mockResolvedValue([f.game]);
  const query = ParticipationModel.updateOne({}, {});
  jest.spyOn(query, 'exec').mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null });
  const reserve = jest.spyOn(ParticipationModel, 'updateOne').mockReturnValue(query);
  const result = await f.service.create(f.game.player1.id, f.game.player2.id, 'AB23', f.session);
  expect(result).toBe(f.game);
  expect(create).toHaveBeenCalledWith(
    [
      expect.objectContaining({
        roomCode: 'AB23',
        roundStartsAt: f.now,
        roundEndsAt: new Date(f.now.getTime() + GAME_CONFIG.ROUND_DURATION_MS),
        player1: expect.objectContaining({ id: f.game.player1.id }),
        player2: expect.objectContaining({ id: f.game.player2.id }),
      }),
    ],
    { session: f.session },
  );
  expect(reserve).toHaveBeenCalledTimes(2);
  for (const id of [f.game.player1.id, f.game.player2.id]) {
    expect(reserve).toHaveBeenCalledWith({ _id: id }, { $set: { mode: 'GAME', gameId: f.game._id, roomCode: 'AB23', joinedAt: f.now, expiresAt: null } }, { upsert: true, session: f.session });
  }
});

test('la création refuse un joueur introuvable sans créer de partie', async () => {
  const f = fixture();
  const create = jest.spyOn(GameModel, 'create');
  await expect(f.service.create(f.game.player1.id, String(new mongoose.Types.ObjectId()), null, f.session)).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
  expect(create).not.toHaveBeenCalled();
});

test("l'historique des manches vérifie l'appartenance puis renvoie les seuls champs publics, paginés", async () => {
  const f = fixture();
  const access = jest.spyOn(f.service, 'findForPlayer').mockResolvedValue(f.game);
  const round = new RoundModel({
    id: String(f.game.roundId),
    gameId: f.game._id,
    roundNumber: 1,
    player1Move: 'rock',
    player2Move: 'scissors',
    outcome: 'PLAYER_1',
    resolvedAt: f.now.toISOString(),
  }).toObject();
  const count = RoundModel.countDocuments();
  jest.spyOn(count, 'exec').mockResolvedValue(3);
  jest.spyOn(RoundModel, 'countDocuments').mockReturnValue(count);
  const query = RoundModel.find();
  jest.spyOn(query.lean(), 'exec').mockResolvedValue([round]);
  const find = jest.spyOn(RoundModel, 'find').mockReturnValue(query);
  const result = await f.service.rounds(String(f.game._id), f.game.player1.id, { page: 2, limit: 1 });
  expect(access).toHaveBeenCalledWith(String(f.game._id), f.game.player1.id);
  expect(find).toHaveBeenCalledWith({ gameId: f.game._id });
  expect(query.getOptions()).toMatchObject({ sort: { roundNumber: -1 }, skip: 1, limit: 1 });
  expect(result).toEqual({
    items: [
      {
        id: round.id,
        roundNumber: 1,
        player1Move: 'rock',
        player2Move: 'scissors',
        outcome: 'PLAYER_1',
        resolvedAt: f.now.toISOString(),
      },
    ],
    page: 2,
    limit: 1,
    total: 3,
    pages: 3,
  });
});
