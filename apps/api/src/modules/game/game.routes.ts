import { gameParamsSchema, paginationSchema, submitMoveSchema } from '@shifu/shared';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireDatabase } from '../../middleware/database.middleware';
import { validate } from '../../middleware/validation.middleware';
import { GameController } from './game.controller';
import type { GameService } from './game.service';

// Assemble les routes authentifiées de consultation, de soumission et de résolution des parties.
export function gameRoutes(service: GameService) {
  const router = Router();
  const controller = new GameController(service);

  router.use(requireAuth);

  router.get('/:id/poll', validate(gameParamsSchema, 'params'), requireDatabase, controller.poll);

  router.post('/:id/action', validate(gameParamsSchema, 'params'), validate(submitMoveSchema), requireDatabase, controller.action);
  // Même transition que le polling : répéter /resolve ne doit pas attribuer un second résultat.
  router.post('/:id/resolve', validate(gameParamsSchema, 'params'), requireDatabase, controller.poll);

  router.get('/:id/rounds', validate(gameParamsSchema, 'params'), validate(paginationSchema, 'query'), requireDatabase, controller.rounds);

  return router;
}
