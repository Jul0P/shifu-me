import { loginSchema, registerSchema } from '@shifu/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireDatabase } from '../../middleware/database.middleware';
import { validate } from '../../middleware/validation.middleware';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// Assemble les routes d'inscription, de connexion et de déconnexion avec leurs protections.
export function authRoutes() {
  const router = Router();
  const controller = new AuthController(new AuthService());
  const limiter = rateLimit({
    windowMs: 900_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Trop de tentatives, réessaie plus tard',
      },
    },
  });
  // Limite et validation avant les accès persistants ; login/register partagent le même quota.
  router.post('/register', limiter, validate(registerSchema), requireDatabase, controller.register);

  router.post('/login', limiter, validate(loginSchema), requireDatabase, controller.login);

  router.post('/logout', requireAuth, controller.logout);

  return router;
}
