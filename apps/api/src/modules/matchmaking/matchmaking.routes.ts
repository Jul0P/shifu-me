import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireDatabase } from '../../middleware/database.middleware';
import { MatchmakingController } from './matchmaking.controller';
import type { MatchmakingService } from './matchmaking.service';

// Assemble les routes authentifiées d'entrée, de suivi et de sortie de la file publique.
export function matchmakingRoutes(service: MatchmakingService) {
  const router = Router();
  const controller = new MatchmakingController(service);

  router.use(requireAuth, requireDatabase);

  router.post('/join', controller.join);

  router.get('/status', controller.status);

  router.delete('/leave', controller.leave);

  return router;
}
