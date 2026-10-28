import { randomInt } from 'node:crypto';
import { GAME_CONFIG, type LobbyResponse, ROOM_ALPHABET } from '@shifu/shared';
import type mongoose from 'mongoose';
import { transaction } from '../../config/database';
import { ApiError } from '../../lib/api-error';
import type { GameService } from '../game/game.service';
import { RoomModel } from '../rooms/room.model';
import { UserModel } from '../users/user.model';
import { LobbyGateModel, ParticipationModel, type ParticipationRecord } from './participation.model';

export class MatchmakingService {
  // Reçoit le moteur utilisé pour créer les parties et rattraper les parties existantes.
  constructor(private readonly games: GameService) {}

  // Sérialise une opération du lobby en transaction et nettoie les attentes expirées.
  private async run<T>(userId: string, work: (session: mongoose.ClientSession, now: Date) => Promise<T>) {
    return transaction(async (session) => {
      // Toutes les décisions de lobby écrivent le même document dans leur transaction.
      // Deux requêtes concurrentes entrent en conflit : le pilote peut en rejouer une avec un état à jour.
      // Cela évite de réserver un joueur deux fois ou de laisser deux arrivants chacun seuls en file.
      await LobbyGateModel.updateOne(
        {
          _id: 'lobby',
        },
        {
          $inc: {
            version: 1,
          },
        },
        {
          session,
        },
      );
      // Revérifie sous le même verrou que la suppression de compte, même après un JWT accepté.
      if (!(await UserModel.exists({ _id: userId }).session(session))) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Ce compte n’existe plus');
      }

      // Nettoie les attentes expirées, jamais les réservations GAME libérées par la finalisation.
      const now = new Date();
      await ParticipationModel.deleteMany(
        {
          mode: {
            $in: ['QUEUE', 'ROOM'],
          },
          expiresAt: {
            $lte: now,
          },
        },
        {
          session,
        },
      );
      await RoomModel.deleteMany(
        {
          expiresAt: {
            $lte: now,
          },
        },
        {
          session,
        },
      );

      return work(session, now);
    });
  }

  // Retrouve l'activité du joueur après avoir fait avancer son éventuelle partie en cours.
  private async current(userId: string, session: mongoose.ClientSession, now: Date) {
    let participation = await ParticipationModel.findById(userId).session(session);

    if (participation?.mode === 'GAME' && participation.gameId) {
      // Un retour au lobby peut rattraper une partie abandonnée, puis constater sa libération.
      const game = await this.games.findForPlayer(String(participation.gameId), userId, session);
      await this.games.advance(game, session, now);
      participation = await ParticipationModel.findById(userId).session(session);
    }

    return participation;
  }

  // Convertit une réservation en statut public idle, searching, waiting ou matched.
  private present(participation: ParticipationRecord | null): LobbyResponse {
    if (!participation) {
      return {
        status: 'idle',
      };
    }

    if (participation.mode === 'GAME' && participation.gameId) {
      return {
        status: 'matched',
        gameId: String(participation.gameId),
      };
    }

    if (participation.mode === 'ROOM' && participation.roomCode && participation.expiresAt) {
      return {
        status: 'waiting',
        code: participation.roomCode,
        expiresAt: participation.expiresAt.toISOString(),
      };
    }

    if (participation.expiresAt) {
      return {
        status: 'searching',
        joinedAt: participation.joinedAt.toISOString(),
        expiresAt: participation.expiresAt.toISOString(),
      };
    }
    throw new ApiError(409, 'INVALID_PARTICIPATION', 'État de recherche invalide');
  }

  // Inscrit ou renouvelle la recherche, puis apparie le joueur au plus ancien adversaire disponible.
  async queue(userId: string, join: boolean): Promise<LobbyResponse> {
    return this.run(userId, async (session, now) => {
      let mine = await this.current(userId, session, now);

      if (mine && mine.mode !== 'QUEUE') {
        return this.present(mine);
      }

      if (!mine && !join) {
        // Consulter le statut d'un joueur inactif ne l'inscrit pas automatiquement dans la file.
        return {
          status: 'idle',
        };
      }

      if (!mine) {
        [mine] = await ParticipationModel.create(
          [
            {
              _id: userId,
              mode: 'QUEUE',
              joinedAt: now,
              expiresAt: new Date(now.getTime() + GAME_CONFIG.QUEUE_LEASE_MS),
            },
          ],
          {
            session,
          },
        );
      }
      // Le polling renouvelle le bail de 30 s : fermer la page finit par retirer la réservation.
      mine.expiresAt = new Date(now.getTime() + GAME_CONFIG.QUEUE_LEASE_MS);
      await mine.save({
        session,
      });
      // Cherche le plus ancien adversaire disponible ; ce matchmaking n'applique pas de filtre Elo.
      const opponent = await ParticipationModel.findOne({
        _id: {
          $ne: userId,
        },
        mode: 'QUEUE',
        expiresAt: {
          $gt: now,
        },
      })
        .sort({
          joinedAt: 1,
          _id: 1,
        })
        .session(session);

      if (!opponent) {
        return this.present(mine);
      }

      // Création et passage des deux réservations en GAME font partie de la même transaction.
      const game = await this.games.create(opponent._id, userId, null, session);

      return {
        status: 'matched',
        gameId: String(game._id),
      };
    });
  }

  // Retire une réservation QUEUE mais conserve toute salle ou partie déjà attribuée.
  async leave(userId: string): Promise<LobbyResponse> {
    return this.run(userId, async (session, now) => {
      const mine = await this.current(userId, session, now);

      if (mine?.mode === 'QUEUE') {
        await ParticipationModel.deleteOne(
          {
            _id: userId,
            mode: 'QUEUE',
          },
          {
            session,
          },
        );

        return {
          status: 'idle',
        };
      }

      // Si l'appariement est déjà fait, renvoie matched au lieu de détruire la partie.
      return this.present(mine);
    });
  }

  // Crée une salle privée avec un code disponible et réserve la place de son hôte.
  async createRoom(userId: string): Promise<LobbyResponse> {
    return this.run(userId, async (session, now) => {
      const mine = await this.current(userId, session, now);

      if (mine?.mode === 'GAME' || mine?.mode === 'ROOM') {
        return this.present(mine);
      }

      if (mine) {
        throw new ApiError(409, 'ALREADY_SEARCHING', 'Quitte la file avant de créer une salle');
      }

      // Le hasard choisit le code ; le contrôle d'existence et l'index unique empêchent sa réutilisation active.
      let code = '';

      for (let attempt = 0; attempt < 50; attempt++) {
        code = Array.from(
          {
            length: 4,
          },
          () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)],
        ).join('');

        if (
          !(await RoomModel.exists({
            code,
          }).session(session))
        ) {
          break;
        }
        code = '';
      }

      if (!code) {
        throw new ApiError(503, 'ROOM_CAPACITY', 'Impossible de générer un code, réessaie');
      }

      const expiresAt = new Date(now.getTime() + GAME_CONFIG.ROOM_TTL_MS);
      await RoomModel.create(
        [
          {
            code,
            hostId: userId,
            expiresAt,
          },
        ],
        {
          session,
        },
      );
      await ParticipationModel.create(
        [
          {
            _id: userId,
            mode: 'ROOM',
            roomCode: code,
            joinedAt: now,
            expiresAt,
          },
        ],
        {
          session,
        },
      );

      return {
        status: 'waiting',
        code,
        expiresAt: expiresAt.toISOString(),
      };
    });
  }

  // Inscrit un invité disponible et crée la partie, ou retrouve celle d'un membre déjà apparié.
  async joinRoom(userId: string, code: string): Promise<LobbyResponse> {
    return this.run(userId, async (session, now) => {
      const room = await RoomModel.findOne({
        code,
        expiresAt: {
          $gt: now,
        },
      }).session(session);

      if (!room) {
        throw new ApiError(404, 'ROOM_NOT_FOUND', 'Salle introuvable ou expirée');
      }

      if (room.gameId) {
        // Une répétition par un membre retrouve la même partie ; un tiers ne peut pas prendre sa place.
        if (room.hostId !== userId && room.guestId !== userId) {
          throw new ApiError(409, 'ROOM_FULL', 'Salle déjà complète');
        }

        return {
          status: 'matched',
          gameId: String(room.gameId),
        };
      }

      if (room.hostId === userId) {
        return {
          status: 'waiting',
          code,
          expiresAt: room.expiresAt.toISOString(),
        };
      }

      if (await this.current(userId, session, now)) {
        throw new ApiError(409, 'PLAYER_BUSY', 'Quitte ta recherche ou ta salle avant de rejoindre');
      }

      const host = await ParticipationModel.findOne({
        _id: room.hostId,
        mode: 'ROOM',
        roomCode: code,
      }).session(session);

      if (!host) {
        throw new ApiError(404, 'ROOM_NOT_FOUND', 'Salle indisponible');
      }

      // Une salle privée utilise le même moteur et les mêmes règles Elo qu'un appariement public.
      const game = await this.games.create(room.hostId, userId, code, session);
      room.guestId = userId;
      room.gameId = game._id;
      await room.save({
        session,
      });

      return {
        status: 'matched',
        gameId: String(game._id),
      };
    });
  }

  // Retourne l'attente ou l'appariement d'une salle non expirée à l'un de ses membres.
  async roomStatus(userId: string, code: string): Promise<LobbyResponse> {
    return this.run(userId, async (session, now) => {
      const room = await RoomModel.findOne({
        code,
        expiresAt: {
          $gt: now,
        },
      }).session(session);

      if (!room) {
        throw new ApiError(404, 'ROOM_NOT_FOUND', 'Salle introuvable ou expirée');
      }

      if (room.hostId !== userId && room.guestId !== userId) {
        // GET consulte la salle ; seul POST join peut inscrire un invité.
        throw new ApiError(403, 'FORBIDDEN', 'Rejoins la salle par POST avant son polling');
      }

      return room.gameId
        ? {
            status: 'matched',
            gameId: String(room.gameId),
          }
        : {
            status: 'waiting',
            code,
            expiresAt: room.expiresAt.toISOString(),
          };
    });
  }

  // Ferme une salle encore en attente à la demande de l'hôte, sans annuler une partie créée.
  async deleteRoom(userId: string, code: string): Promise<LobbyResponse> {
    return this.run(userId, async (session, now) => {
      const room = await RoomModel.findOne({
        code,
      }).session(session);

      if (!room) {
        return {
          status: 'idle',
        };
      }

      if (room.hostId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'Seul le créateur peut fermer la salle');
      }

      if (room.gameId) {
        return {
          status: 'matched',
          gameId: String(room.gameId),
        };
      }

      await RoomModel.deleteOne(
        {
          _id: room._id,
        },
        {
          session,
        },
      );
      await ParticipationModel.deleteOne(
        {
          _id: userId,
          mode: 'ROOM',
          roomCode: code,
        },
        {
          session,
        },
      );

      return this.present(await this.current(userId, session, now));
    });
  }
}
