import type { PublicUser } from '@shifu/shared';
import type { UserModel } from './user.model';

type UserDoc = InstanceType<typeof UserModel>;
export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: String(user._id),
    username: String(user.get('username')),
    avatar: String(user.get('avatar')),
    elo: Number(user.get('elo')),
    stats: {
      wins: Number(user.get('stats.wins') ?? 0),
      losses: Number(user.get('stats.losses') ?? 0),
    },
  };
}
