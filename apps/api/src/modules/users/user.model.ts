import { GAME_CONFIG } from '@shifu/shared';
import mongoose from 'mongoose';

interface UserRecord {
  username: string;
  usernameLower: string;
  passwordHash: string;
  avatar: string;
  elo: number;
  stats: {
    wins: number;
    losses: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<UserRecord>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    usernameLower: {
      // L'index unique porte sur la forme normalisée : Ninja et ninja ne peuvent pas coexister.
      type: String,
      required: true,
      unique: true,
    },
    passwordHash: {
      // Exclu des lectures ordinaires ; seuls les contrôles de mot de passe le sélectionnent explicitement.
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      type: String,
      default: '🪨',
    },
    elo: {
      type: Number,
      default: GAME_CONFIG.INITIAL_ELO,
      min: GAME_CONFIG.MIN_ELO,
    },
    stats: {
      wins: {
        type: Number,
        default: 0,
        min: 0,
      },
      losses: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);
userSchema.index({
  elo: -1,
  'stats.wins': -1,
  _id: 1,
});

// Réutilise le modèle déjà enregistré lors des réimports, notamment en développement.
export const UserModel = (mongoose.models.User as mongoose.Model<UserRecord> | undefined) ?? mongoose.model<UserRecord>('User', userSchema);

export type UserDocument = mongoose.HydratedDocument<UserRecord>;
