import mongoose from 'mongoose';

// Une réservation d'activité par compte : l'_id utilisateur interdit deux documents pour le même joueur.
export interface ParticipationRecord {
  _id: string;
  mode: 'QUEUE' | 'ROOM' | 'GAME';
  gameId: mongoose.Types.ObjectId | null;
  roomCode: string | null;
  joinedAt: Date;
  expiresAt: Date | null;
}

const schema = new mongoose.Schema<ParticipationRecord>(
  {
    _id: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      enum: ['QUEUE', 'ROOM', 'GAME'],
      required: true,
    },
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    roomCode: {
      type: String,
      default: null,
    },
    joinedAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'participations',
  },
);
schema.index({
  mode: 1,
  joinedAt: 1,
});
// Pas de TTL : seule la finalisation doit libérer une réservation GAME.
// Le service nettoie explicitement les réservations QUEUE/ROOM après leur expiration.

export const ParticipationModel = (mongoose.models.Participation as mongoose.Model<ParticipationRecord> | undefined) ?? mongoose.model<ParticipationRecord>('Participation', schema);

interface LobbyGateRecord {
  _id: string;
  version: number;
}

// Verrou logique persistant, pas une file en mémoire : son écriture ordonne les transactions du lobby.
const gateSchema = new mongoose.Schema<LobbyGateRecord>(
  {
    _id: String,
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    collection: 'coordination',
  },
);

export const LobbyGateModel = (mongoose.models.LobbyGate as mongoose.Model<LobbyGateRecord> | undefined) ?? mongoose.model<LobbyGateRecord>('LobbyGate', gateSchema);
