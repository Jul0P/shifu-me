import type { RequestHandler } from 'express';
import { connectDB } from '../config/database';

// Seules les routes utilisant MongoDB appellent ce middleware.
export const requireDatabase: RequestHandler = async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
};
