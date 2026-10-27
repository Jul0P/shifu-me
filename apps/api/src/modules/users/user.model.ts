import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    usernameLower: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    passwordHash: {
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
      default: 100,
      min: 0,
    },
    stats: {
      wins: {
        type: Number,
        default: 0,
      },
      losses: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  },
);

export const UserModel = mongoose.models.User ?? mongoose.model('User', userSchema);
