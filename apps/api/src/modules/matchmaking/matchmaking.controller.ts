import type { RequestHandler } from 'express';
import type { MatchmakingService } from './matchmaking.service';

export class MatchmakingController {
  // Reçoit le service qui gère les réservations et les appariements.
  constructor(private readonly service: MatchmakingService) {}

  // Inscrit le joueur authentifié dans la file ou retrouve son activité actuelle.
  join: RequestHandler = async (_req, res) => {
    res.json(await this.service.queue(res.locals.userId, true));
  };

  // Consulte et renouvelle une recherche existante sans inscrire un joueur inactif.
  status: RequestHandler = async (_req, res) => {
    res.json(await this.service.queue(res.locals.userId, false));
  };

  // Annule la recherche si elle attend encore, sans détruire un appariement déjà réalisé.
  leave: RequestHandler = async (_req, res) => {
    res.json(await this.service.leave(res.locals.userId));
  };
}
