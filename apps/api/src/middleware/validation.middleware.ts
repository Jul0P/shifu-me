import type { RequestHandler } from 'express';
import type { z } from 'zod';

// Construit un middleware Zod pour valider le body, les paramètres d'URL ou la query.
export function validate(schema: z.ZodType, source: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  // Place les données validées dans res.locals avant de poursuivre la requête.
  return (req, res, next) => {
    // Conserve la version validée et normalisée sans réécrire req.query (getter dans Express 5).
    // Une erreur Zod remonte au gestionnaire central ; le contrôleur ne reçoit pas de données invalides.
    res.locals[source] = schema.parse(req[source]);
    next();
  };
}
