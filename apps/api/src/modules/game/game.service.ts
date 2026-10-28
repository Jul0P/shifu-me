import { GAME_CONFIG, type GameResponse, type Move, type Pagination } from '@shifu/shared';
import mongoose from 'mongoose';
import { transaction } from '../../config/database';
import { ApiError } from '../../lib/api-error';
import { ParticipationModel } from '../matchmaking/participation.model';
import { UserModel } from '../users/user.model';
import { toPublicUser } from '../users/users.service';
import { type GameDocument, GameModel, MatchModel, RoundModel } from './game.model';
import { resolveMoves, shouldCancelAfterBothAfk, updatedElo } from './game-engine';

export class GameService {
  // Crée la partie, ses snapshots de joueurs et leurs réservations GAME.
  // Réutilise la transaction du lobby : partie et réservations des deux joueurs sont indivisibles.
  async create(player1Id: string, player2Id: string, roomCode: string | null, session: mongoose.ClientSession) {
    if (player1Id === player2Id) {
      throw new ApiError(409, 'SELF_MATCH', 'Impossible de jouer contre soi-même');
    }

    const p1 = await UserModel.findById(player1Id).session(session);
    const p2 = await UserModel.findById(player2Id).session(session);

    if (!p1 || !p2) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Joueur introuvable');
    }

    const now = new Date();
    const [game] = await GameModel.create(
      [
        {
          // Snapshots publics : conservent l'identité affichée au début du match, sans hash de mot de passe.
          player1: {
            ...toPublicUser(p1),
            lastSeenAt: now,
          },
          player2: {
            ...toPublicUser(p2),
            lastSeenAt: now,
          },
          roomCode,
          roundId: new mongoose.Types.ObjectId(),
          roundStartsAt: now,
          roundEndsAt: new Date(now.getTime() + GAME_CONFIG.ROUND_DURATION_MS),
          eloAfter: {
            player1: p1.elo,
            player2: p2.elo,
          },
        },
      ],
      {
        session,
      },
    );

    for (const id of [player1Id, player2Id]) {
      await ParticipationModel.updateOne(
        {
          _id: id,
        },
        {
          $set: {
            mode: 'GAME',
            gameId: game._id,
            roomCode,
            joinedAt: now,
            expiresAt: null,
          },
        },
        {
          upsert: true,
          session,
        },
      );
    }

    return game;
  }

  // Charge une partie et refuse l'accès si le demandeur n'est pas l'un de ses joueurs.
  async findForPlayer(id: string, userId: string, session?: mongoose.ClientSession) {
    const query = GameModel.findById(id);

    if (session) {
      query.session(session);
    }

    const game = await query;

    if (!game) {
      throw new ApiError(404, 'GAME_NOT_FOUND', 'Partie introuvable');
    }

    if (game.player1.id !== userId && game.player2.id !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Tu ne participes pas à cette partie');
    }

    return game;
  }

  // Résout les manches expirées et ouvre la suivante ou finalise la partie.
  // Toutes les lectures/écritures rejoignent la transaction de l'appelant.
  // La boucle rattrape aussi plusieurs deadlines après une longue absence, sans setTimeout serveur.
  async advance(game: GameDocument, session: mongoose.ClientSession, now = new Date()) {
    while (game.status === 'PLAYING' && now.getTime() >= game.roundEndsAt.getTime()) {
      const outcome = resolveMoves(game.player1Move, game.player2Move);

      if (outcome === 'PLAYER_1') {
        game.score.player1++;
      }

      if (outcome === 'PLAYER_2') {
        game.score.player2++;
      }
      // Une égalité ou un forfait simple interrompt la série de doubles absences.
      game.consecutiveBothAfk = outcome === 'BOTH_AFK' ? game.consecutiveBothAfk + 1 : 0;
      const result = {
        id: String(game.roundId),
        roundNumber: game.roundNumber,
        player1Move: game.player1Move,
        player2Move: game.player2Move,
        outcome,
        resolvedAt: now.toISOString(),
      };
      game.lastResult = result;
      await RoundModel.create(
        [
          {
            ...result,
            gameId: game._id,
          },
        ],
        {
          session,
        },
      );

      if (shouldCancelAfterBothAfk(game.consecutiveBothAfk)) {
        game.status = 'CANCELLED';
        await this.finish(game, session, now);
      } else if (game.score.player1 >= GAME_CONFIG.WINS_TO_VICTORY || game.score.player2 >= GAME_CONFIG.WINS_TO_VICTORY) {
        game.status = 'COMPLETED';
        game.winnerId = game.score.player1 >= GAME_CONFIG.WINS_TO_VICTORY ? game.player1.id : game.player2.id;
        await this.finish(game, session, now);
      } else {
        // Ancre la manche sur la deadline persistée, pas sur l'arrivée du polling : l'absence ne gèle pas le jeu.
        game.roundStartsAt = new Date(game.roundEndsAt.getTime() + GAME_CONFIG.ROUND_REVEAL_MS);
        game.roundEndsAt = new Date(game.roundStartsAt.getTime() + GAME_CONFIG.ROUND_DURATION_MS);
        game.roundId = new mongoose.Types.ObjectId();
        game.roundNumber++;
        game.player1Move = null;
        game.player2Move = null;
      }
      await game.save({
        session,
      });
    }

    return game;
  }

  // Finalise la partie, applique l'Elo et l'historique si elle est gagnée, puis libère les joueurs.
  private async finish(game: GameDocument, session: mongoose.ClientSession, now: Date) {
    // Statut final, Elo, statistiques, historique et libération restent dans la transaction du round.
    // Une annulation saute les écritures de joueurs/historique, mais libère aussi les réservations.
    game.finishedAt = now;
    const p1 = await UserModel.findById(game.player1.id).session(session);
    const p2 = await UserModel.findById(game.player2.id).session(session);

    if (!p1 || !p2) {
      throw new ApiError(409, 'PLAYER_UNAVAILABLE', 'Joueur indisponible');
    }

    const before = {
      player1: p1.elo,
      player2: p2.elo,
    };

    if (game.status === 'COMPLETED') {
      const winner = game.winnerId === game.player1.id ? p1 : p2;
      const loser = winner === p1 ? p2 : p1;
      const elo = updatedElo(winner.elo, loser.elo);
      winner.elo = elo.winner;
      loser.elo = elo.loser;
      winner.stats.wins++;
      loser.stats.losses++;
      await p1.save({
        session,
      });
      await p2.save({
        session,
      });
      game.eloDelta = {
        player1: p1.elo - before.player1,
        player2: p2.elo - before.player2,
      };
      game.eloAfter = {
        player1: p1.elo,
        player2: p2.elo,
      };

      await MatchModel.create(
        [
          {
            gameId: game._id,
            player1: game.player1,
            player2: game.player2,
            winnerId: String(winner._id),
            roomCode: game.roomCode,
            score: game.score,
            eloBefore: before,
            eloAfter: game.eloAfter,
            eloDelta: game.eloDelta,
            finishedAt: now,
          },
        ],
        {
          session,
        },
      );
    } else {
      game.eloAfter = before;
    }

    await ParticipationModel.deleteMany(
      {
        gameId: game._id,
        mode: 'GAME',
      },
      {
        session,
      },
    );
  }

  // Rattrape les deadlines, actualise la présence et retourne l'état autorisé pour le demandeur.
  async poll(id: string, userId: string): Promise<GameResponse> {
    return transaction(async (session) => {
      const game = await this.findForPlayer(id, userId, session);
      const now = new Date();
      await this.advance(game, session, now);

      if (game.status === 'PLAYING') {
        // La présence est indicative ; un forfait dépend du coup absent à la deadline, pas du polling.
        (game.player1.id === userId ? game.player1 : game.player2).lastSeenAt = now;
        await game.save({
          session,
        });
      }

      return this.present(game, userId, now);
    });
  }

  // Enregistre le premier coup valide de la manche par une écriture conditionnelle avant la deadline.
  async action(id: string, userId: string, roundId: string, move: Move): Promise<GameResponse> {
    return transaction(async (session) => {
      const game = await this.findForPlayer(id, userId, session);

      if (game.status !== 'PLAYING') {
        throw new ApiError(409, 'GAME_FINISHED', 'La partie est terminée');
      }

      if (String(game.roundId) !== roundId) {
        throw new ApiError(409, 'STALE_ROUND', 'Identifiant de manche périmé');
      }

      const now = new Date();

      if (now < game.roundStartsAt) {
        throw new ApiError(409, 'ROUND_NOT_STARTED', 'La prochaine manche ne commence pas encore');
      }

      if (now >= game.roundEndsAt) {
        throw new ApiError(409, 'ROUND_EXPIRED', 'Délai dépassé, coup refusé');
      }

      const side = game.player1.id === userId ? 'player1' : 'player2';
      const moveField = side === 'player1' ? 'player1Move' : 'player2Move';

      if (game[moveField] !== null) {
        throw new ApiError(409, 'MOVE_LOCKED', 'Ton coup est déjà verrouillé pour cette manche');
      }

      // Recontrôle au moment de l'écriture : version __v, manche courante et choix encore nul.
      // $$NOW utilise l'horloge MongoDB pour la fenêtre de jeu, indépendamment du chrono du navigateur.
      // L'incrément de version protège aussi contre un save() concurrent issu d'un polling.
      const accepted = await GameModel.findOneAndUpdate(
        {
          _id: game._id,
          status: 'PLAYING',
          roundId: game.roundId,
          [moveField]: null,
          __v: game.__v,
          $expr: {
            $and: [
              {
                $gt: ['$roundEndsAt', '$$NOW'],
              },
              {
                $lte: ['$roundStartsAt', '$$NOW'],
              },
            ],
          },
        },
        {
          $set: {
            [`${side}Move`]: move,
            [`${side}.lastSeenAt`]: now,
          },
          $inc: {
            __v: 1,
          },
        },
        {
          returnDocument: 'after',
          session,
        },
      );

      if (!accepted) {
        throw new ApiError(409, 'ROUND_EXPIRED', 'La manche a changé ou sa deadline est dépassée');
      }

      // Répond dès l'enregistrement du choix : même deux coups soumis ne résolvent pas avant la deadline.
      return this.present(accepted, userId, new Date());
    });
  }

  // Retourne les manches résolues de la partie, paginées et accessibles uniquement à ses joueurs.
  async rounds(id: string, userId: string, pagination: Pagination) {
    // L'historique des manches révèle les coups résolus : vérifier l'appartenance avant de le lire.
    await this.findForPlayer(id, userId);
    const filter = {
      gameId: new mongoose.Types.ObjectId(id),
    };

    const total = await RoundModel.countDocuments(filter);
    const rows = await RoundModel.find(filter)
      .sort({
        roundNumber: -1,
      })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean();

    return {
      items: rows.map(({ id, roundNumber, player1Move, player2Move, outcome, resolvedAt }) => ({
        id,
        roundNumber,
        player1Move,
        player2Move,
        outcome,
        resolvedAt,
      })),
      ...pagination,
      total,
      pages: Math.max(1, Math.ceil(total / pagination.limit)),
    };
  }

  // Construit la vue du joueur sans divulguer le coup adverse avant sa résolution.
  present(game: GameDocument, userId: string, now: Date): GameResponse {
    const first = game.player1.id === userId;
    const mySide = first ? 'player1' : 'player2';
    const otherSide = first ? 'player2' : 'player1';
    // Extrait l'identité publique et les indicateurs de présence et de soumission d'un joueur.
    const player = (side: 'player1' | 'player2') => ({
      id: game[side].id,
      username: game[side].username,
      avatar: game[side].avatar,
      elo: game.eloAfter[side],
      submitted: game[`${side}Move`] !== null,
      connected: now.getTime() - game[side].lastSeenAt.getTime() < GAME_CONFIG.PRESENCE_TIMEOUT_MS,
    });
    // Projection explicite : seul me contient le choix courant ; opponent n'expose que submitted.
    // Les coups des deux joueurs apparaissent uniquement dans le résultat d'une manche déjà résolue.
    return {
      id: String(game._id),
      status: game.status,
      phase: game.status !== 'PLAYING' ? 'FINISHED' : now < game.roundStartsAt ? 'REVEAL' : 'CHOOSING',
      serverTime: now.toISOString(),
      roomCode: game.roomCode,
      side: first ? 'PLAYER_1' : 'PLAYER_2',
      score: {
        me: game.score[mySide],
        opponent: game.score[otherSide],
      },
      consecutiveBothAfk: game.consecutiveBothAfk,
      me: {
        ...player(mySide),
        move: first ? game.player1Move : game.player2Move,
      },
      opponent: player(otherSide),
      round: {
        id: String(game.roundId),
        number: game.roundNumber,
        startsAt: game.roundStartsAt.toISOString(),
        endsAt: game.roundEndsAt.toISOString(),
      },
      lastResult: game.lastResult
        ? {
            id: game.lastResult.id,
            roundNumber: game.lastResult.roundNumber,
            player1Move: game.lastResult.player1Move,
            player2Move: game.lastResult.player2Move,
            outcome: game.lastResult.outcome,
            resolvedAt: game.lastResult.resolvedAt,
          }
        : null,
      finish: game.finishedAt
        ? {
            winnerId: game.winnerId,
            myDelta: game.eloDelta[mySide],
            myElo: game.eloAfter[mySide],
            opponentElo: game.eloAfter[otherSide],
            finishedAt: game.finishedAt.toISOString(),
          }
        : null,
    };
  }
}
