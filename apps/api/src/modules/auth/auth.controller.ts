import type { RequestHandler } from 'express';
import type { AuthService } from './auth.service';

export class AuthController {
  // Reçoit le service qui gère les comptes et les sessions de connexion.
  constructor(private readonly service: AuthService) {}

  // Inscrit le joueur avec les données validées et retourne sa session avec le statut 201.
  register: RequestHandler = async (_req, res) => {
    res.status(201).json(await this.service.register(res.locals.body));
  };

  // Connecte le joueur et retourne son profil public ainsi que son JWT.
  login: RequestHandler = async (_req, res) => {
    res.json(await this.service.login(res.locals.body));
  };

  // Révoque la session authentifiée et termine la réponse sans contenu.
  logout: RequestHandler = async (_req, res) => {
    await this.service.logout(res.locals.userId, res.locals.sessionId);
    res.status(204).end();
  };
}
