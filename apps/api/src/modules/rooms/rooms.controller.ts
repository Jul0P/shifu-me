import type { RequestHandler } from 'express';
import type { MatchmakingService } from '../matchmaking/matchmaking.service';

export class RoomsController {
  // Reçoit le service de lobby partagé avec le matchmaking public.
  constructor(private readonly service: MatchmakingService) {}

  // Demande la création d'une salle privée pour le joueur authentifié.
  create: RequestHandler = async (_req, res) => {
    res.json(await this.service.createRoom(res.locals.userId));
  };

  // Demande à rejoindre la salle dont le code a été validé.
  join: RequestHandler = async (_req, res) => {
    res.json(await this.service.joinRoom(res.locals.userId, res.locals.params.code));
  };

  // Consulte l'état de la salle pour le joueur authentifié.
  status: RequestHandler = async (_req, res) => {
    res.json(await this.service.roomStatus(res.locals.userId, res.locals.params.code));
  };

  // Demande la fermeture de la salle, sous contrôle des droits de son créateur.
  leave: RequestHandler = async (_req, res) => {
    res.json(await this.service.deleteRoom(res.locals.userId, res.locals.params.code));
  };
}
