import { roomParamsSchema } from '@shifu/shared';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireDatabase } from '../../middleware/database.middleware';
import { validate } from '../../middleware/validation.middleware';
import type { MatchmakingService } from '../matchmaking/matchmaking.service';
import { RoomsController } from './rooms.controller';

// Assemble les routes de création, d'accès, de suivi et de fermeture des salles privées.
export function roomsRoutes(service: MatchmakingService) {
  const router = Router();
  const controller = new RoomsController(service);

  router.use(requireAuth);

  router.post('/', requireDatabase, controller.create);

  router.post('/:code/join', validate(roomParamsSchema, 'params'), requireDatabase, controller.join);

  router.get('/:code', validate(roomParamsSchema, 'params'), requireDatabase, controller.status);

  router.delete('/:code', validate(roomParamsSchema, 'params'), requireDatabase, controller.leave);

  return router;
}
