import mongoose from 'mongoose';

interface AuthSessionRecord {
  _id: string;
  userId: string;
  expiresAt: Date;
}

// Une session de connexion, distincte d'une partie : _id correspond au jti contenu dans le JWT.
const schema = new mongoose.Schema<AuthSessionRecord>(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: 'auth_sessions',
  },
);
// Le TTL supprime les anciennes sessions ; l'authentification vérifie aussi expiresAt à chaque appel.
schema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  },
);
schema.index({
  userId: 1,
});

export const AuthSessionModel = (mongoose.models.AuthSession as mongoose.Model<AuthSessionRecord> | undefined) ?? mongoose.model<AuthSessionRecord>('AuthSession', schema);
