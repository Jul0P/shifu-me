import type { Pagination, PublicUser } from '@shifu/shared';
import bcrypt from 'bcrypt';
import { transaction } from '../../config/database';
import { ApiError } from '../../lib/api-error';
import { AuthSessionModel } from '../auth/auth-session.model';
import { GameModel, MatchModel } from '../game/game.model';
import { LobbyGateModel, ParticipationModel } from '../matchmaking/participation.model';
import { RoomModel } from '../rooms/room.model';
import { type UserDocument, UserModel } from './user.model';

// Construit un profil public à partir des seuls champs autorisés du document utilisateur.
export function toPublicUser(user: UserDocument): PublicUser {
  // Liste blanche des champs renvoyés : ne jamais sérialiser le document et son hash directement.
  return {
    id: String(user._id),
    username: user.username,
    avatar: user.avatar,
    elo: user.elo,
    stats: {
      wins: user.stats.wins,
      losses: user.stats.losses,
    },
  };
}

export class UsersService {
  // Vérifie le mot de passe puis supprime le compte et anonymise ses résultats, hors partie active.
  async deleteAccount(id: string, password: string) {
    const user = await UserModel.findById(id).select('+passwordHash');

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiError(403, 'INVALID_PASSWORD', 'Le mot de passe est incorrect');
    }

    await transaction(async (session) => {
      // Même verrou que le matchmaking : une suppression et un appariement ne doivent pas se croiser.
      await LobbyGateModel.updateOne({ _id: 'lobby' }, { $inc: { version: 1 } }, { session });

      if (!(await UserModel.exists({ _id: id }).session(session))) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
      }

      const activeGame = await GameModel.exists({
        status: 'PLAYING',
        $or: [{ 'player1.id': id }, { 'player2.id': id }],
      }).session(session);

      if (activeGame) {
        throw new ApiError(409, 'ACTIVE_GAME', 'Termine ta partie en cours avant de supprimer ton compte');
      }

      // Anonymise l'identité affichée sans retirer les résultats ni modifier l'Elo des adversaires.
      for (const side of ['player1', 'player2'] as const) {
        const filter = { [`${side}.id`]: id };
        const update = { $set: { [`${side}.username`]: 'Compte supprimé', [`${side}.avatar`]: '👤' } };

        await GameModel.updateMany(filter, update, { session });
        await MatchModel.updateMany(filter, update, { session });
      }

      await RoomModel.deleteMany({ $or: [{ hostId: id }, { guestId: id }] }, { session });
      await ParticipationModel.deleteOne({ _id: id }, { session });
      await AuthSessionModel.deleteMany({ userId: id }, { session });
      await UserModel.deleteOne({ _id: id }, { session });
    });
  }

  // Charge le compte demandé et retourne son profil public, ou signale son absence.
  async me(id: string) {
    const user = await UserModel.findById(id);

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
    }

    return toPublicUser(user);
  }

  // Modifie le pseudo et/ou l'avatar, synchronise le pseudo normalisé et retourne le profil public.
  async update(
    id: string,
    input: {
      username?: string;
      avatar?: string;
    },
  ) {
    const update: Record<string, string> = {};

    if (input.username) {
      update.username = input.username;
      update.usernameLower = input.username.toLowerCase();
    }

    if (input.avatar) {
      update.avatar = input.avatar;
    }

    const user = await UserModel.findByIdAndUpdate(
      id,
      {
        $set: update,
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
    }

    return toPublicUser(user);
  }

  // Liste les matchs achevés du joueur avec leurs scores et variations Elo, par page.
  async history(userId: string, pagination: Pagination) {
    // Lit les bilans matches, pas les sessions en cours : les annulations ne sont jamais ajoutées ici.
    const filter = {
      $or: [
        {
          'player1.id': userId,
        },
        {
          'player2.id': userId,
        },
      ],
    };

    const total = await MatchModel.countDocuments(filter);
    const matches = await MatchModel.find(filter)
      .sort({
        finishedAt: -1,
        _id: -1,
      })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean();
    // Replace chaque bilan dans la perspective du demandeur, qu'il soit player1 ou player2.
    const items = matches.map((match) => {
      const first = match.player1.id === userId;
      const side = first ? 'player1' : 'player2';
      const other = first ? 'player2' : 'player1';
      const opponent = match[other];

      return {
        id: String(match._id),
        gameId: String(match.gameId),
        opponent: {
          id: opponent.id,
          username: opponent.username,
          avatar: opponent.avatar,
          elo: opponent.elo,
          stats: {
            wins: opponent.stats.wins,
            losses: opponent.stats.losses,
          },
        },
        myScore: match.score[side],
        opponentScore: match.score[other],
        won: match.winnerId === userId,
        eloDelta: match.eloDelta[side],
        eloBefore: match.eloBefore[side],
        eloAfter: match.eloAfter[side],
        finishedAt: match.finishedAt.toISOString(),
        roomCode: match.roomCode,
      };
    });

    return {
      items,
      ...pagination,
      total,
      pages: Math.max(1, Math.ceil(total / pagination.limit)),
    };
  }
}
