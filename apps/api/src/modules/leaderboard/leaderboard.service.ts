import type { Pagination } from '@shifu/shared';
import { UserModel } from '../users/user.model';
import { toPublicUser } from '../users/users.service';

export class LeaderboardService {
  // Retourne une page du classement par Elo avec le rang absolu et le taux de victoire.
  async list(pagination: Pagination) {
    const total = await UserModel.countDocuments();
    // Départage les Elo égaux par victoires puis _id, pour un ordre stable tant que les données ne changent pas.
    const users = await UserModel.find()
      .sort({
        elo: -1,
        'stats.wins': -1,
        _id: 1,
      })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit);
    const items = users.map((user, index) => {
      const played = user.stats.wins + user.stats.losses;

      return {
        ...toPublicUser(user),
        // Rang absolu sur toutes les pages, pas un compteur qui recommence à 1 sur chacune.
        rank: (pagination.page - 1) * pagination.limit + index + 1,
        winRate: played ? Math.round((100 * user.stats.wins) / played) : 0,
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
