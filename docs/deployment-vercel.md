# Déploiement Vercel — à valider en Preview

## Préparation

1. `pnpm install` (génère le `pnpm-lock.yaml`, absent de l'archive faute d'accès réseau dans l'environnement de génération).
2. `pnpm check`, puis commit du lockfile.
3. Créer une base MongoDB Atlas séparée pour la production ; configurer un utilisateur DB et l'accès réseau sécurisé.
4. Créer **deux projets** Vercel reliés au même repo :

| Application | Root Directory | Preset                           | Variables                                                          |
| ----------- | -------------- | -------------------------------- | ------------------------------------------------------------------ |
| frontend    | `apps/web`     | Vite                             | `VITE_API_URL` = URL publique de l'API                             |
| backend     | `apps/api`     | Express / Other (auto-detection) | `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production` |

Ne pas définir `MONGODB_URI` ou `JWT_SECRET` en variables `VITE_*` (elles seraient intégrées au bundle navigateur).

Le backend exporte `app` depuis `apps/api/src/index.ts` sans `listen()`. La connexion Mongoose est établie à la demande par les routes qui en ont besoin (`connectDB()` mutualise la connexion sur une instance chaude).

## Premiers essais requis

- Sur l'API : `/api/health`, `/api/openapi.json`, `/api/docs`.
- Sur le frontend : `/`, `/leaderboard`, puis rafraîchir `/login` pour tester le rewrite SPA.
- Inscription et connexion en production (sans compromettre les secrets).
- Vérifier que `@shifu/shared` est embarqué et que le Root Directory ne masque pas le package partagé.
- Tester les PR Preview de plusieurs contributeurs ; Vercel Hobby peut limiter les déploiements automatiques sur repo privé collaboratif.

Le déploiement Vercel n'est pas nécessaire pour l'exécution locale du starter.
