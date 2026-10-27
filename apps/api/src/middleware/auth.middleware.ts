import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

export const requireAuth: RequestHandler = (req, res, next) => {
  const match = /^Bearer (.+)$/.exec(req.header('authorization') ?? '');
  const secret = process.env.JWT_SECRET;
  if (!match || !secret) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentification requise',
      },
    });
    return;
  }
  try {
    const decoded = jwt.verify(match[1], secret, {
      algorithms: [
        'HS256',
      ],
    }) as JwtPayload;
    if (typeof decoded.sub !== 'string') throw new Error('Missing subject');
    res.locals.userId = decoded.sub;
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Jeton invalide ou expiré',
      },
    });
  }
};
