import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../lib/api-error';

// Signale qu'aucune route déclarée ne correspond à la requête.
export const notFound: RequestHandler = () => {
  throw new ApiError(404, 'NOT_FOUND', 'Route introuvable');
};

// Traduit les erreurs connues en réponses JSON et masque les détails des erreurs internes.
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    // Une réponse déjà commencée ne peut plus être remplacée par notre objet JSON.
    next(error);

    return;
  }

  let status = 500,
    code = 'INTERNAL_ERROR',
    message = 'Erreur serveur';

  if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
    message = error.message;
  } else if (error instanceof ZodError) {
    status = 400;
    code = 'INVALID_INPUT';
    message = error.issues[0]?.message ?? 'Entrée invalide';
  } else if (error instanceof SyntaxError && 'body' in error) {
    status = 400;
    code = 'INVALID_INPUT';
    message = 'JSON invalide';
  } else if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    status = 409;
    code = 'CONFLICT';
    message = 'Cette ressource existe déjà (pseudo ou identifiant unique)';
  } else if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Corps de requête trop volumineux';
  } else if (typeof error === 'object' && error !== null && 'status' in error && error.status === 415) {
    status = 415;
    code = 'UNSUPPORTED_MEDIA_TYPE';
    message = 'Encodage du corps de requête non pris en charge';
  } else if (error instanceof mongoose.mongo.MongoNetworkError || error instanceof mongoose.Error.MongooseServerSelectionError || (typeof error === 'object' && error !== null && 'name' in error && ['MongoServerSelectionError', 'MongoNetworkError'].includes(String(error.name)))) {
    status = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'Connexion MongoDB indisponible';
  }
  // Les erreurs brutes du driver ou de validation peuvent contenir des secrets ou le corps reçu.
  if (status === 500) {
    console.error('API INTERNAL_ERROR', error instanceof Error ? error.name : 'UnknownError');
  }
  res.status(status).json({
    error: {
      code,
      message,
    },
  });
};
