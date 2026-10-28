import mongoose from 'mongoose';

interface RoomRecord {
  code: string;
  hostId: string;
  guestId: string | null;
  gameId: mongoose.Types.ObjectId | null;
  expiresAt: Date;
}

// Point de rendez-vous par code ; gameId référence la vraie partie créée à l'arrivée de l'invité.
const schema = new mongoose.Schema<RoomRecord>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    hostId: {
      type: String,
      required: true,
    },
    guestId: {
      type: String,
      default: null,
    },
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: 'rooms',
  },
);
// Le TTL nettoie les salles, mais le service contrôle la date sans attendre ce nettoyage asynchrone.
schema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  },
);

export const RoomModel = (mongoose.models.Room as mongoose.Model<RoomRecord> | undefined) ?? mongoose.model<RoomRecord>('Room', schema);
