import type { RequestHandler } from 'express';
import type { LeaderboardService } from '../leaderboard/leaderboard.service';
import type { UsersService } from './users.service';

export class UsersController {
  // Reçoit les services du profil utilisateur et du classement public.
  constructor(
    private readonly service: UsersService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  // Retourne le profil public du compte authentifié.
  me: RequestHandler = async (_req, res) => {
    res.json(await this.service.me(res.locals.userId));
  };

  // Met à jour le profil authentifié avec les champs validés.
  update: RequestHandler = async (_req, res) => {
    res.json(await this.service.update(res.locals.userId, res.locals.body));
  };

  // Demande la suppression du compte avec son mot de passe puis répond sans contenu.
  deleteAccount: RequestHandler = async (_req, res) => {
    await this.service.deleteAccount(res.locals.userId, res.locals.body.password);
    res.status(204).end();
  };

  // Retourne une page de l'historique du compte authentifié.
  history: RequestHandler = async (_req, res) => {
    res.json(await this.service.history(res.locals.userId, res.locals.query));
  };

  // Retourne la page demandée du classement public.
  board: RequestHandler = async (_req, res) => {
    res.json(await this.leaderboard.list(res.locals.query));
  };
}
