# ✊ Shifu.me — Monorepo starter

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-informational)](#ci)

Micro-jeu de **pierre-feuille-ciseaux compétitif** (BO5, rounds de 10 s, Elo, HTTP polling). Ce dépôt est **le starter technique**, pas le jeu complet.

## Prérequis

- Node.js **24 LTS** (fichier `.nvmrc`).
- pnpm **12.15.0** (`packageManager` dans le `package.json` racine).
- Git ; GitHub CLI `gh` facultative.
- MongoDB Atlas (cluster gratuit possible) pour inscription, connexion et classement. **Pas de Docker**.

Les dépendances directes des quatre workspaces sont fixées à des versions exactes dans leurs `package.json` ; les dépendances internes conservent `workspace:*`. Le fichier `pnpm-lock.yaml` verrouille les résolutions transitives et doit être versionné avec les manifests. Pour reproduire l'installation, utiliser `pnpm install --frozen-lockfile`.

Les versions ont été reprises des paquets déjà installés et du lockfile, avec `@types/node` aligné sur Node 24 (`24.19.2`). Toute mise à jour doit être suivie de `pnpm check`. Le script `build` de l'API reste un message d'information pour Vercel : il ne compile pas le serveur ; `typecheck` vérifie ses types.

Sous PowerShell, si l'exécution de `pnpm.ps1` est bloquée, remplacer `pnpm` par `pnpm.cmd` dans les commandes, sans modifier la politique d'exécution du système.

## Démarrage rapide (PowerShell)

```powershell
# Depuis la racine du monorepo
pnpm install --frozen-lockfile
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
# Remplacer JWT_SECRET et MONGODB_URI par leurs vraies valeurs dans apps/api/.env
pnpm dev
```

- Web : <http://localhost:5173>
- API : <http://localhost:3000/api/health> (renvoie `{"status":"ok"}` sans MongoDB)
- Swagger : <http://localhost:3000/api/docs>
- OpenAPI : <http://localhost:3000/api/openapi.json>
- Frontend leaderboard et auth : nécessitent une connexion MongoDB opérationnelle.

Générer un secret JWT aléatoire :

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`FRONTEND_URL=http://localhost:5173` permet le CORS en développement. Ne jamais committer `.env` ou `.env.local`.

## Scripts

| Commande                         | Résultat                                                                   |
| -------------------------------- | -------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Installe les workspaces sans modifier le lockfile                          |
| `pnpm dev`                       | Lance les serveurs web + API via Turbo                                     |
| `pnpm --filter @shifu/web dev`   | Web seul                                                                   |
| `pnpm --filter @shifu/api dev`   | API seule                                                                  |
| `pnpm lint`                      | Vérification Biome                                                         |
| `pnpm lint:fix`                  | Corrections Biome                                                          |
| `pnpm format`                    | Formatage Biome                                                            |
| `pnpm build`                     | Build Vite puis vérification TS (génère `routeTree.gen.ts`)                |
| `pnpm typecheck`                 | Vérification TypeScript ; lancer `pnpm build` au moins une fois auparavant |
| `pnpm test`                      | Tests Jest des deux apps, incl. Supertest                                  |
| `pnpm test:watch`                | Tests en mode watch                                                        |
| `pnpm check`                     | Tout vérifier (lint, build, types, tests)                                  |
| `pnpm outdated -r`               | Voir les versions plus récentes                                            |
| `pnpm update -r --latest`        | Mises à jour majeures possibles : relancer la CI                           |

La politique ciblée de `pnpm-workspace.yaml` autorise les scripts de `esbuild`, `@swc/core`, `@parcel/watcher`, `bcrypt` et `unrs-resolver`. Le script de télémétrie de `@scarf/scarf` est refusé. Les agent skills TanStack sont également refusées, indépendamment des scripts de build. Si une nouvelle dépendance demande une approbation, examiner son script avant d'utiliser `pnpm approve-builds` ; ne pas autoriser tous les scripts globalement.

## Organisation

```text
apps/web/                 React + Vite, Tailwind, TanStack Router/Query
  src/components/ui/      Composants shadcn-like locaux
  src/features/           Domaines React (créés au fil des sprints)
  src/routes/             Fichiers de routes TanStack
  tests/                  TOUS les tests web séparés du code source
apps/api/                 Express + Mongoose + JWT
  src/modules/            Modules métier (auth, users, game, ...)
  tests/unit/             Tests unitaires
  tests/integration/      Supertest ; future base Mongo de test dédiée
  openapi/openapi.json    Spec des seules routes implémentées
packages/shared/          Types Zod et constantes partagés
.github/workflows/ci.yml CI sur PR + main
docs/                     Cadrage Shifu.me et décisions techniques
```

Le dossier `apps/web/src/features/` est volontairement prêt à recevoir des fonctionnalités ; il n'y a pas d'obligation de créer des sous-dossiers vides immédiatement.

## Fonctionnalités disponibles

- `GET /api/health` public, sans MongoDB.
- `POST /api/auth/register` inscription pseudo/mot de passe (bcrypt, JWT, Elo 100).
- `POST /api/auth/login` connexion pseudo/mot de passe.
- `GET /api/users/leaderboard` classement Top 50.
- `GET /api/users/me` et `PUT /api/users/me` profil protégé par JWT.
- Tests unitaires du moteur Pierre/Feuille/Ciseaux, forfait, Elo, double-AFK (pas encore branché à des parties en base).
- Landing néo-brutaliste, inscription/connexion simples, route leaderboard.

**À implémenter** : session auth durable côté navigateur, file de matchmaking, état de partie en base, BO5 complet, chrono serveur, coups synchronisés, 5 doubles AFK, classement transactionnel, historique, protections de concurrence. Les pages correspondantes affichent des messages explicites. Voir `docs/api-roadmap.md`.

## GitHub — créer et pousser le repo

```powershell
git init -b main
git add .
git commit -m "chore: bootstrap Shifu.me monorepo"
gh auth login
gh repo create shifu-me --private --source=. --remote=origin --push
```

Alternative sans GitHub CLI : créer un dépôt **vide** `shifu-me` sur github.com, puis :

```powershell
git remote add origin https://github.com/VOTRE_COMPTE/shifu-me.git
git push -u origin main
```

Important : inclure les quatre manifests, `pnpm-workspace.yaml` et `pnpm-lock.yaml` dans le premier commit ; vérifier auparavant `pnpm install --frozen-lockfile` et `pnpm check`. Si le dépôt existe déjà, ne répétez pas `git init` ; copiez les fichiers et effectuez un commit.

## CI

`.github/workflows/ci.yml` : `actions/checkout@v7`, `pnpm/setup@v3` et `pnpm install --frozen-lockfile`, puis Biome, build, TS, Jest. Les tests fournis n'ont pas besoin d'Atlas. Les tests avec DB utiliseront une base **distincte de la production**.

## Vercel + MongoDB Atlas

Créer 2 projets Vercel reliés au même dépôt, root directories `apps/web` (preset Vite) et `apps/api` (Express), avec les variables définies dans les `.env.example`. La base se trouve dans Atlas : **pas de Docker, pas de MongoDB dans Vercel**. Voir `docs/deployment-vercel.md` pour les vérifications de preview et les restrictions possibles d'un dépôt privé sur Hobby.

## Cadrage

`docs/documentation_de_cadrage_Shifu.me.md` : document source fourni, à préserver pour les décisions de produit. La création d'un jeu libre et le travail en équipe doivent rester validés côté EFREI si le livret original s'applique.
