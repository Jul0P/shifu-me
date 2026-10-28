import { AVATARS, GAME_CONFIG } from '@shifu/shared';
import cors from 'cors';
import express, { type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { requireTransactions } from './config/database';
import { initializeDatabase } from './config/models';
import openapi from './config/openapi';
import { errorHandler, notFound } from './middleware/errors.middleware';
import { authRoutes } from './modules/auth/auth.routes';
import { gameRoutes } from './modules/game/game.routes';
import { GameService } from './modules/game/game.service';
import { matchmakingRoutes } from './modules/matchmaking/matchmaking.routes';
import { MatchmakingService } from './modules/matchmaking/matchmaking.service';
import { roomsRoutes } from './modules/rooms/rooms.routes';
import { usersRoutes } from './modules/users/users.routes';

// Construire l'application sans listen() permet son import par Supertest et Vercel.
const app = express();
// Ces services ne gardent aucun état de partie en mémoire ; leurs données restent dans MongoDB.
const games = new GameService();
const matchmaking = new MatchmakingService(games);
app.disable('x-powered-by');
// Vercel termine TLS à son proxy ; ne faire confiance qu'à un seul saut lorsqu'on y est.
if (process.env.VERCEL) {
  app.set('trust proxy', 1);
}
app.use(helmet()); // Applique les en-têtes de sécurité, dont la politique CSP.
app.use(
  // Autorise l'origine du frontend dans le navigateur ; CORS ne remplace pas l'authentification.
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  }),
);
// Désactive le cache HTTP de toutes les réponses API, y compris les erreurs suivantes.
app.use('/api', (_req, res, next) => {
  // Avant le parseur et les limiteurs : leurs erreurs ne doivent pas être mises en cache non plus.
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(
  // Borne les corps JSON avant la validation Zod ; un corps trop volumineux reçoit 413.
  express.json({
    limit: '16kb',
  }),
);
// Limite par IP et par instance : les compteurs ne sont pas partagés entre les fonctions Vercel.
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Trop de requêtes',
      },
    },
  }),
);
// La santé du processus reste consultable sans base ; /ready vérifie aussi la persistance.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
  });
});
// Vérifie la préparation de la base et sa compatibilité transactionnelle avant de déclarer l'API prête.
app.get('/api/ready', async (_req, res) => {
  await initializeDatabase();
  await requireTransactions();
  res.json({
    status: 'ready',
    transactions: true,
  });
});
// Le client lit les mêmes constantes que le moteur, mais ne décide ni des délais ni des scores.
app.get('/api/config', (_req, res) => {
  res.json({
    avatars: AVATARS,
    roundDurationMs: GAME_CONFIG.ROUND_DURATION_MS,
    revealDurationMs: GAME_CONFIG.ROUND_REVEAL_MS,
    winsToVictory: GAME_CONFIG.WINS_TO_VICTORY,
    matchmakingPollMs: GAME_CONFIG.MATCHMAKING_POLL_MS,
    gamePollMs: GAME_CONFIG.GAME_POLL_MS,
  });
});
// Retourne la spécification OpenAPI utilisée par Swagger et les clients de documentation.
app.get('/api/openapi.json', (_req, res) => {
  res.json(openapi);
});
// Retire la CSP uniquement sur la documentation pour permettre l'initialisation de Swagger UI.
const disableDocsCsp: RequestHandler = (_req, res, next) => {
  // L'initialisation de Swagger UI utilise du JavaScript inline ; exception limitée à /api/docs.
  res.removeHeader('Content-Security-Policy');
  next();
};
app.use(
  '/api/docs',
  disableDocsCsp,
  swaggerUi.serve,
  swaggerUi.setup(openapi, {
    swaggerOptions: {
      // Ne pas conserver le JWT saisi dans Swagger après rechargement.
      persistAuthorization: false,
    },
  }),
);
app.use('/api/auth', authRoutes());
app.use('/api/users', usersRoutes());
app.use('/api/matchmaking', matchmakingRoutes(matchmaking));
app.use('/api/rooms', roomsRoutes(matchmaking));
app.use('/api/game', gameRoutes(games));
// Après toutes les routes : une URL inconnue devient 404, puis l'erreur est normalisée en JSON.
// Express 5 transmet aussi les rejets des handlers async à ce dernier middleware.
app.use(notFound);
app.use(errorHandler);

export default app;
