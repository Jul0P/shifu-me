import cors from 'cors';
import express, { type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import openapi from '../openapi/openapi.json';
import { errorHandler, notFound } from './middleware/errors.middleware';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  }),
);
app.use(
  express.json({
    limit: '16kb',
  }),
);
// Compteur mémoire local uniquement, ne remplace pas une limite distribuée sur Vercel.
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
  });
});
app.get('/api/openapi.json', (_req, res) => {
  res.json(openapi);
});
// Swagger UI utilise des scripts/styles inline : CSP désactivée seulement pour /api/docs.
const disableDocsCsp: RequestHandler = (_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
};
app.use('/api/docs', disableDocsCsp, swaggerUi.serve, swaggerUi.setup(openapi));
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
// Le matchmaking et les parties seront branchés ici dans le sprint suivant.
app.use(notFound);
app.use(errorHandler);
export default app;
