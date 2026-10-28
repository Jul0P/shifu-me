import type { RequestHandler } from 'express';
import { initializeDatabase } from '../config/models';

// Attend la préparation de MongoDB avant de laisser la requête accéder aux données.
export const requireDatabase: RequestHandler = async (_req, _res, next) => {
  // Se connecter ne suffit pas : les index et le document de coordination doivent aussi être prêts.
  await initializeDatabase();
  next();
};
