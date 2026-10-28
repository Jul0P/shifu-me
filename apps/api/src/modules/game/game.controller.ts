import type { RequestHandler } from 'express';
import type { GameService } from './game.service';

// Adaptateur HTTP : transmet les données validées et l'identité du JWT ; le service applique les règles.
export class GameController {
  // Reçoit le service chargé des parties et de leurs manches.
  constructor(private readonly service: GameService) {}

  // Fait avancer la partie si nécessaire et retourne l'état visible par le joueur authentifié.
  poll: RequestHandler = async (_req, res) => {
    res.json(await this.service.poll(res.locals.params.id, res.locals.userId));
  };

  // Transmet le coup validé et l'identité authentifiée au moteur de partie.
  action: RequestHandler = async (_req, res) => {
    res.json(await this.service.action(res.locals.params.id, res.locals.userId, res.locals.body.roundId, res.locals.body.move));
  };

  // Retourne une page de manches résolues après contrôle d'accès par le service.
  rounds: RequestHandler = async (_req, res) => {
    res.json(await this.service.rounds(res.locals.params.id, res.locals.userId, res.locals.query));
  };
}
