import { deleteAccountSchema, paginationSchema, updateProfileSchema } from '@shifu/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireDatabase } from '../../middleware/database.middleware';
import { validate } from '../../middleware/validation.middleware';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Assemble le classement public et les routes privées de profil, d'historique et de suppression.
export function usersRoutes() {
  const router = Router();
  const controller = new UsersController(new UsersService(), new LeaderboardService());
  const deletionLimiter = rateLimit({
    windowMs: 900_000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives de suppression, réessaie plus tard' } },
  });

  router.get('/leaderboard', validate(paginationSchema, 'query'), requireDatabase, controller.board);

  router.get('/me', requireAuth, requireDatabase, controller.me);

  router.put('/me', requireAuth, validate(updateProfileSchema), requireDatabase, controller.update);

  router.delete('/me', requireAuth, deletionLimiter, validate(deleteAccountSchema), requireDatabase, controller.deleteAccount);

  router.get('/me/history', requireAuth, validate(paginationSchema, 'query'), requireDatabase, controller.history);

  return router;
}
