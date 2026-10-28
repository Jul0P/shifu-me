import type { Move, PublicUser } from '@shifu/shared';
import mongoose from 'mongoose';
import type { RoundOutcome } from './game-engine';

interface PlayerSnapshot extends PublicUser {
  lastSeenAt: Date;
}

interface RoundResult {
  id: string;
  roundNumber: number;
  player1Move: Move | null;
  player2Move: Move | null;
  outcome: RoundOutcome;
  resolvedAt: string;
}

// État vivant d'une partie : choix privés, deadline, score et dernier résultat pour le polling.
interface GameRecord {
  player1: PlayerSnapshot;
  player2: PlayerSnapshot;
  status: 'PLAYING' | 'COMPLETED' | 'CANCELLED';
  roomCode: string | null;
  roundId: mongoose.Types.ObjectId;
  roundNumber: number;
  roundStartsAt: Date;
  roundEndsAt: Date;
  player1Move: Move | null;
  player2Move: Move | null;
  score: {
    player1: number;
    player2: number;
  };
  consecutiveBothAfk: number;
  lastResult: RoundResult | null;
  winnerId: string | null;
  eloDelta: {
    player1: number;
    player2: number;
  };
  eloAfter: {
    player1: number;
    player2: number;
  };
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new mongoose.Schema<PlayerSnapshot>(
  {
    id: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      required: true,
    },
    elo: {
      type: Number,
      required: true,
    },
    stats: {
      wins: Number,
      losses: Number,
    },
    lastSeenAt: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const resultSchema = new mongoose.Schema<RoundResult>(
  {
    id: String,
    roundNumber: Number,
    player1Move: {
      type: String,
      default: null,
    },
    player2Move: {
      type: String,
      default: null,
    },
    outcome: {
      type: String,
      enum: ['PLAYER_1', 'PLAYER_2', 'TIE', 'BOTH_AFK'],
    },
    resolvedAt: String,
  },
  {
    _id: false,
  },
);

const gameSchema = new mongoose.Schema<GameRecord>(
  {
    player1: {
      type: playerSchema,
      required: true,
    },
    player2: {
      type: playerSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['PLAYING', 'COMPLETED', 'CANCELLED'],
      default: 'PLAYING',
      required: true,
    },
    roomCode: {
      type: String,
      default: null,
    },
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    roundNumber: {
      type: Number,
      default: 1,
    },
    roundStartsAt: {
      type: Date,
      required: true,
    },
    roundEndsAt: {
      type: Date,
      required: true,
    },
    player1Move: {
      type: String,
      enum: ['rock', 'paper', 'scissors', null],
      default: null,
    },
    player2Move: {
      type: String,
      enum: ['rock', 'paper', 'scissors', null],
      default: null,
    },
    score: {
      player1: {
        type: Number,
        default: 0,
      },
      player2: {
        type: Number,
        default: 0,
      },
    },
    consecutiveBothAfk: {
      type: Number,
      default: 0,
    },
    lastResult: {
      type: resultSchema,
      default: null,
    },
    winnerId: {
      type: String,
      default: null,
    },
    eloDelta: {
      player1: {
        type: Number,
        default: 0,
      },
      player2: {
        type: Number,
        default: 0,
      },
    },
    eloAfter: {
      player1: {
        type: Number,
        required: true,
      },
      player2: {
        type: Number,
        required: true,
      },
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'game_sessions',
    // save() vérifie __v : une version devenue obsolète ne doit pas écraser un coup ou un résultat récent.
    optimisticConcurrency: true,
  },
);
gameSchema.index({
  'player1.id': 1,
  status: 1,
});
gameSchema.index({
  'player2.id': 1,
  status: 1,
});

export const GameModel = (mongoose.models.GameSession as mongoose.Model<GameRecord> | undefined) ?? mongoose.model<GameRecord>('GameSession', gameSchema);

export type GameDocument = mongoose.HydratedDocument<GameRecord>;

// Une collection séparée évite de faire grossir la session sans limite en cas d'égalités répétées.
interface ResolvedRoundRecord extends RoundResult {
  gameId: mongoose.Types.ObjectId;
}

const roundSchema = new mongoose.Schema<ResolvedRoundRecord>(
  {
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
    roundNumber: {
      type: Number,
      required: true,
    },
    player1Move: {
      type: String,
      default: null,
    },
    player2Move: {
      type: String,
      default: null,
    },
    outcome: {
      type: String,
      required: true,
      enum: ['PLAYER_1', 'PLAYER_2', 'TIE', 'BOTH_AFK'],
    },
    resolvedAt: {
      type: String,
      required: true,
    },
  },
  {
    collection: 'game_rounds',
  },
);
// Une seule résolution enregistrée par numéro de manche et par partie.
roundSchema.index(
  {
    gameId: 1,
    roundNumber: 1,
  },
  {
    unique: true,
  },
);

export const RoundModel = (mongoose.models.GameRound as mongoose.Model<ResolvedRoundRecord> | undefined) ?? mongoose.model<ResolvedRoundRecord>('GameRound', roundSchema);

// Bilan historique d'une partie COMPLETED ; aucune entrée n'est créée pour CANCELLED.
interface MatchRecord {
  gameId: mongoose.Types.ObjectId;
  player1: PlayerSnapshot;
  player2: PlayerSnapshot;
  winnerId: string;
  roomCode: string | null;
  score: {
    player1: number;
    player2: number;
  };
  eloBefore: {
    player1: number;
    player2: number;
  };
  eloAfter: {
    player1: number;
    player2: number;
  };
  eloDelta: {
    player1: number;
    player2: number;
  };
  finishedAt: Date;
}

const matchSchema = new mongoose.Schema<MatchRecord>(
  {
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // Garde-fou contre deux bilans pour la même partie, en complément de la transaction.
      unique: true,
    },
    player1: {
      type: playerSchema,
      required: true,
    },
    player2: {
      type: playerSchema,
      required: true,
    },
    winnerId: {
      type: String,
      required: true,
    },
    roomCode: {
      type: String,
      default: null,
    },
    score: {
      player1: Number,
      player2: Number,
    },
    eloBefore: {
      player1: Number,
      player2: Number,
    },
    eloAfter: {
      player1: Number,
      player2: Number,
    },
    eloDelta: {
      player1: Number,
      player2: Number,
    },
    finishedAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: 'matches',
  },
);
matchSchema.index({
  'player1.id': 1,
  finishedAt: -1,
  _id: -1,
});
matchSchema.index({
  'player2.id': 1,
  finishedAt: -1,
  _id: -1,
});

export const MatchModel = (mongoose.models.Match as mongoose.Model<MatchRecord> | undefined) ?? mongoose.model<MatchRecord>('Match', matchSchema);
