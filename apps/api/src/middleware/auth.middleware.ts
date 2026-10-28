import type { RequestHandler } from 'express';
import { connectDB } from '../config/database';
import { ApiError } from '../lib/api-error';
import { AuthService } from '../modules/auth/auth.service';

const auth = new AuthService();

// Vérifie le JWT et sa session persistée, puis transmet l'identité authentifiée au contrôleur.
export const requireAuth: RequestHandler = async (req, res, next) => {
  const match = /^Bearer (\S+)$/.exec(req.header('authorization') ?? '');

  if (!match) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentification requise');
  }

  let identity: {
    userId: string;
    sessionId: string;
  };

  try {
    identity = auth.verify(match[1]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      throw error;
    }
    throw new ApiError(401, 'UNAUTHORIZED', 'Jeton invalide ou expiré');
  }

  // La signature seule ne suffit pas : une déconnexion peut avoir révoqué la session MongoDB.
  await connectDB();
  await auth.active(identity.userId, identity.sessionId);
  // Identité de confiance pour les contrôleurs, jamais tirée d'un userId envoyé dans le body.
  res.locals.userId = identity.userId;
  res.locals.sessionId = identity.sessionId;
  next();
};
