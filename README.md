# ✊ Shifu.me — Chifoumi multijoueur

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-informational)](#ci)

Micro-jeu de **pierre-feuille-ciseaux compétitif** (BO5, rounds de 10 s, Elo, HTTP polling). Le frontend React utilise l’API Express pour les parcours multijoueurs persistants. Ce README centralise l’installation, l’architecture, les tests et le déploiement ; le dossier de documentation séparé a été retiré.

## Prérequis

- Node.js **24 LTS** (fichier `.nvmrc`).
- pnpm **12.15.0** (`packageManager` dans le `package.json` racine).
- Git ; GitHub CLI `gh` facultative.
- MongoDB Community Server local en replica set ou MongoDB Atlas. **Pas de Docker**. Voir [la configuration MongoDB](#mongodb-local).

Les dépendances directes des quatre workspaces sont fixées à des versions exactes dans leurs `package.json` ; les dépendances internes conservent `workspace:*`. Le fichier `pnpm-lock.yaml` verrouille les résolutions transitives et doit être versionné avec les manifests. Pour reproduire l'installation, utiliser `pnpm install --frozen-lockfile`.

`saveExact: true` dans `pnpm-workspace.yaml` conserve des versions exactes lors des prochains ajouts avec pnpm 12. Le réglage équivalent de `.npmrc` est conservé pour npm ; pnpm 12 lit ce réglage dans le workspace.

Les versions ont été reprises des paquets déjà installés et du lockfile, avec `@types/node` aligné sur Node 24 (`24.19.2`). Toute mise à jour doit être suivie de `pnpm check`. Le script `build` API vérifie TypeScript ; il ne produit pas de bundle serveur autonome. Swagger est directement servi depuis les schémas partagés, sans génération sur disque. Les tests backend utilisent Jest/Supertest sur Node 24, avec transformation TypeScript par SWC et sans accès MongoDB. Les tests frontend utilisent Vitest pour les unités et Playwright/Chromium pour les parcours avec réponses API simulées.

Sous PowerShell, si l'exécution de `pnpm.ps1` est bloquée, remplacer `pnpm` par `pnpm.cmd` dans les commandes, sans modifier la politique d'exécution du système.

## Démarrage rapide (PowerShell)

```powershell
# Depuis la racine du monorepo
pnpm install --frozen-lockfile
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local
# Remplacer JWT_SECRET et MONGODB_URI par leurs vraies valeurs dans apps/api/.env
pnpm dev
```

- Web : <http://localhost:5173>
- API : <http://localhost:3000/api/health> (renvoie `{"status":"ok"}` sans MongoDB)
- Swagger : <http://localhost:3000/api/docs>
- OpenAPI : <http://localhost:3000/api/openapi.json>
- Les données et parcours de jeu nécessitent l’API et une connexion MongoDB opérationnelles.

Générer un secret JWT aléatoire :

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`FRONTEND_URL=http://localhost:5173` permet le CORS en développement. Ne jamais committer `.env` ou `.env.local`.

Copier les fichiers d’environnement uniquement s’ils n’existent pas déjà, pour ne pas écraser une configuration locale.

## MongoDB local

L’API utilise le serveur existant sur `127.0.0.1:27017`, la base `shifu_me` et un replica set à un membre nommé `rs0`. Les transactions multi-documents ne fonctionnent pas sur un serveur standalone.

Dans la configuration du service MongoDB existant, conserver les paramètres de stockage et de réseau et configurer :

```yaml
replication:
  replSetName: rs0
```

Après redémarrage de ce service, se connecter avec `mongosh "mongodb://127.0.0.1:27017/?directConnection=true"` et consulter `rs.status()`. Uniquement si le replica set n’est pas encore initialisé, lancer une fois :

```javascript
rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] });
```

Ne pas réinitialiser un replica set existant ni supprimer de base. L’URI locale peut être `mongodb://127.0.0.1:27017/shifu_me?replicaSet=rs0`. L’API prépare automatiquement les collections, les index et la coordination du lobby ; aucune importation Compass n’est nécessaire. `/api/ready` vérifie la préparation et la prise en charge des transactions, contrairement à `/api/health`.

## Scripts

| Commande                                 | Résultat                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`         | Installe les workspaces sans modifier le lockfile                          |
| `pnpm dev`                               | Lance les serveurs web + API via Turbo                                     |
| `pnpm --filter @shifu/web dev`           | Web seul                                                                   |
| `pnpm --filter @shifu/api dev`           | API seule                                                                  |
| `pnpm lint`                              | Vérification Biome                                                         |
| `pnpm lint:fix`                          | Corrections Biome                                                          |
| `pnpm format`                            | Formatage Biome                                                            |
| `pnpm build`                             | Build Vite, routes générées et vérification TypeScript API/web/shared      |
| `pnpm typecheck`                         | Vérification TypeScript ; lancer `pnpm build` au moins une fois auparavant |
| `pnpm test`                              | Tests API et frontend, sans connexion MongoDB                              |
| `pnpm test:api`                          | Tests API Jest/Supertest                                                   |
| `pnpm test:web`                          | Tests web Vitest et Playwright/Chromium                                    |
| `pnpm --filter @shifu/api test:coverage` | Rapport de couverture API et vérification des seuils                       |
| `pnpm check`                             | Vérifier le lint, le build, les types et les tests API/web                 |
| `pnpm outdated -r`                       | Voir les versions plus récentes                                            |
| `pnpm update -r --latest`                | Mises à jour majeures possibles : relancer la CI                           |

La politique ciblée de `pnpm-workspace.yaml` autorise les scripts de `esbuild`, `@parcel/watcher`, `bcrypt` et `@swc/core` (transformation TypeScript pour Jest). Les scripts de `@scarf/scarf` (télémétrie) et `unrs-resolver` (non nécessaire avec les binaires précompilés de l'installation vérifiée) sont refusés. Les agent skills TanStack sont également refusées, indépendamment des scripts de build. Si une nouvelle dépendance demande une approbation, examiner son script avant d'utiliser `pnpm approve-builds` ; ne pas autoriser tous les scripts globalement.

Avant le premier test navigateur : `pnpm --filter @shifu/web exec playwright install chromium` (en CI Linux : `pnpm --filter @shifu/web exec playwright install --with-deps chromium`). Playwright démarre et arrête son propre serveur Vite sur `127.0.0.1:4173` ; le port doit être libre. Il n'a besoin ni de l'API ni de MongoDB. Voir [les tests automatisés](#tests-automatisés).

## Organisation

```text
apps/web/                 React + Vite, Tailwind, TanStack Router/Query
  src/components/ui/      Composants shadcn-like locaux
  src/features/           Auth, accueil, profil, classement, matchmaking, salles et jeu
  src/routes/             Fichiers de routes TanStack
  tests/unit/             Vitest : client HTTP, session, jeu, polling et composants simples
  tests/e2e/              Playwright : parcours navigateur avec API simulée
  tests/helpers/          Données et simulation HTTP communes
apps/api/                 Express + Mongoose + JWT
  src/modules/            Modules métier (auth, users, game, ...)
  tests/unit/             Jest : règles, transitions, JWT, contrats, profils, classement et lobby
  tests/integration/      Express réel via Supertest, accès aux données simulés
  tests/functional/       Parcours public de découverte et indisponibilité de la base
  src/config/openapi.ts    Spec des seules routes implémentées
packages/shared/          Types Zod et constantes partagés
.github/workflows/ci.yml CI sur PR + main/dev
```

Les routes composent les pages ; les fonctionnalités regroupent leurs composants, hooks et accès API. TanStack Query gère les lectures et mutations, les schémas partagés valident les entrées et les réponses.

### API et persistance

Le backend suit le flux routes → contrôleurs → services → modèles Mongoose. `app.ts` construit Express sans ouvrir de port, `server.ts` écoute en local et `index.ts` exporte l’application pour Vercel. Les middlewares centralisent authentification, préparation de la base, validation Zod et erreurs JSON `{ error: { code, message } }`.

Les comptes, sessions JWT révocables, réservations, salles, parties et manches sont persistés. Le lobby sérialise ses décisions avec un document de coordination et une réservation unique par compte. Les transactions lient les écritures métier : compte/session à l’inscription, score/Elo/historique à la finalisation et nettoyage/anonymisation à la suppression.

Les deadlines sont enregistrées côté serveur. Les requêtes suivantes font avancer les manches expirées, sans timer de processus ni WebSocket. Un match se termine à trois manches gagnées ; les égalités peuvent dépasser cinq manches. Deux choix absents donnent une double absence sans point ; cinq doubles absences consécutives annulent la partie sans Elo ni historique visible.

### Frontend

TanStack Router génère `routeTree.gen.ts` : ne pas le modifier à la main. Le fichier `game.$gameId.tsx` représente `/game/:gameId` ; `$gameId` est un paramètre dynamique, pas un dossier.

Le client conserve token, identifiant et expiration dans `sessionStorage` et recharge le profil depuis l’API. Logout et 401 nettoient session/cache. Ce stockage reste accessible au JavaScript : il ne protège pas le JWT contre une injection XSS ; aucun secret JWT ou identifiant MongoDB ne doit apparaître dans une variable `VITE_*`.

Le polling utilise environ 1 s pour la recherche et les salles, 1,5 s pour une partie active, avec ralentissement sur échec et reprise au retour de l’onglet. Les lectures sont annulables et les mutations ne sont pas rejouées automatiquement. Le premier coup accepté reste verrouillé et le coup adverse reste caché jusqu’à la résolution officielle. Score, Elo et historique sont exclusivement calculés par le serveur.

## Fonctionnalités disponibles

- Authentification JWT révocable : inscription, connexion, déconnexion ; profil et avatar, Elo initial 100.
- Suppression du compte avec confirmation du mot de passe, révocation des sessions et anonymisation des anciens résultats.
- Matchmaking persistant avec annulation et reprise après rafraîchissement ; réservation unique par joueur.
- Salles privées à code, expiration et inscription explicite par POST.
- BO5 serveur : manches de 10 s, premier choix verrouillé et caché, égalités, forfaits et cinq doubles AFK consécutifs.
- Finalisation transactionnelle : Elo ±10 (plancher 0), statistiques et historique attribués une seule fois.
- Classement paginé avec rang/ratio, podium via `limit=3`, historique et résultats de manches paginés.
- Swagger servi directement depuis les schémas Zod partagés.

Pages disponibles : `/`, `/register`, `/login`, `/profile`, `/leaderboard`, `/history`, `/play`, `/rooms` et `/game/:gameId`. Les pages privées attendent la restauration du profil avant de rediriger. La modification et la suppression du profil se font sur `/profile` ; une suppression nécessite le mot de passe actuel et est refusée pendant une partie active.

Le contrat HTTP réellement implémenté est consultable dans Swagger et `/api/openapi.json`, généré à partir des schémas partagés et des métadonnées des routes. Les previews Vercel/Atlas et la charge production restent à valider.

## Tests automatisés

```powershell
pnpm test:api
pnpm --filter @shifu/api test:unit
pnpm --filter @shifu/api test:integration
pnpm --filter @shifu/api test:coverage
pnpm test:web
pnpm --filter @shifu/web test:unit
pnpm --filter @shifu/web test:e2e
```

- **API : Jest/Supertest**, descriptions en français, accès MongoDB bloqué par le setup. Les règles, services et contrats sont testés avec des doubles ; Supertest exécute Express pour vérifier routes, statuts et erreurs.
- **Unitaires frontend : Vitest**, dans Node sans jsdom supplémentaire : HTTP, erreurs, session, horloge, polling et composants simples rendus en HTML statique.
- **Navigateur : Playwright/Chromium**, sur le vrai client React avec réponses API interceptées : auth, profil/suppression, cache, matchmaking, salles, jeu, classement, historique et viewport mobile.
- Les données de test sont fictives et indépendantes. Les tests ne créent aucune base et ne touchent pas aux données de `shifu_me`. Les transactions, le rollback et les courses réelles MongoDB nécessitent une recette séparée avec des comptes dédiés explicitement identifiés.
- La couverture API impose 90 % des lignes/instructions/fonctions et 85 % des branches. Le rapport HTML est dans `apps/api/coverage/index.html`. Aucun pourcentage de couverture frontend n’est déduit des scénarios simulés.
- Les traces Playwright en échec sont conservées dans `apps/web/test-results/`, ignoré par Git. Une recette sur appareils physiques et autres navigateurs reste complémentaire.

## Workflow Git

`main` reste la branche stable. `dev` est créée depuis `main` ; les branches `features/<sujet>` partent de la dernière version de `dev` et y sont intégrées avant la suivante. Les commits suivent `type(scope): message` en anglais. Conserver les commits lors des intégrations dans `dev` ; ne pas squash ni réécrire l’historique sans décision explicite.

Avant une intégration stable, vérifier `pnpm check` et la CI distante. Aucun push, aucune PR ni intégration dans `main` n’est implicite.

## CI

`.github/workflows/ci.yml` : Node 24, pnpm 12.15.0, installation figée, Biome, build/types, installation Chromium et tests API/frontend sans MongoDB. La CI est déclenchée sur les PR et les push vers `main` ou `dev`. Le build contrôle chaque package sans second passage TypeScript dans `check` ou la CI ; `pnpm typecheck` reste disponible séparément. La réussite du workflow doit être vérifiée sur GitHub après push.

## Vercel + MongoDB Atlas

Créer deux projets Vercel reliés au même dépôt, root directories `apps/web` (preset Vite) et `apps/api` (Express). Autoriser l’accès au package workspace `packages/shared` depuis chacun. Conserver l’installation pnpm avec lockfile et Node 24 ; vérifier la compatibilité effective du runtime et de l’offre choisie.

- **Web** : définir `VITE_API_URL` avec l’origine HTTPS de l’API avant le build. `apps/web/vercel.json` réécrit les URLs SPA vers `index.html`.
- **API** : définir `NODE_ENV=production`, `MONGODB_URI` Atlas, `JWT_SECRET` aléatoire, `JWT_EXPIRES_IN` et `FRONTEND_URL` avec l’origine exacte du web. Les secrets ne vont jamais dans `VITE_*`. `src/index.ts` exporte Express sans appeler `listen()`.
- **Atlas** : configurer un utilisateur dédié, ses permissions sur la base et les accès réseau compatibles avec l’hébergement. La base est externe : **pas de Docker, pas de MongoDB dans Vercel**.
- **Recette preview** : vérifier health/ready, Swagger, CORS depuis le web, rafraîchissement d’une route privée, restauration de session, matchmaking, salle et finalisation d’un match avec historique/Elo.

Les limiteurs en mémoire ne sont pas distribués entre instances Vercel. Le déploiement, les restrictions de collaboration des offres et les conditions réelles de charge doivent être vérifiés dans l’environnement cible ; les tests locaux ne les certifient pas.
