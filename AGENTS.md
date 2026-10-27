# AGENTS.md — Contexte permanent et instructions Codex de Shifu.me

> **À lire en entier avant de proposer ou modifier du code.** Ce document restitue les décisions de conception prises avec le porteur du projet. Il décrit le résultat attendu **et** les limitations du starter initial. Les fichiers réellement présents dans le dépôt sont toujours la source de vérité concernant ce qui est implémenté. En cas de différence, ne pas affirmer qu'une fonctionnalité existe sans l'avoir vérifiée.
>
> **Langue de communication : français.** Code, noms de symboles et termes techniques : anglais lorsque cela facilite la cohérence. Réponses concrètes, argumentées, sans inventer de résultats de tests ni de compatibilités.

## 1. Identité, objectifs et statut

- **Projet :** Shifu.me, application web multijoueur de pierre-feuille-ciseaux (Chifoumi), compétitive, simple et rapide, jouable sur navigateur desktop ou mobile.
- **Équipe :** 4 développeurs, projet étudiant EFREI. Tenir compte de la facilité de collaboration, des tests et du déploiement, sans surarchitecture.
- **Objectif fonctionnel :** authentification, matchmaking automatique, parties BO5, chrono serveur, absence de triche par anticipation des coups, classement Elo et historique.
- **Document fonctionnel de référence :** `docs/documentation_de_cadrage_Shifu.me.md` (issu du cadrage donné par le porteur de projet). Le lire lorsque la tâche touche aux règles métier, au design ou aux fonctionnalités.
- **Compléments techniques existants :** `README.md`, `docs/architecture.md`, `docs/api-roadmap.md`, `docs/team-workflow.md`, `docs/commandes.md`, `docs/deployment-vercel.md`.
- Le dépôt issu du ZIP est un **starter**, pas une application multijoueur terminée. Ne jamais présenter les pages de démonstration ou les fonctions pures comme un moteur de jeu complet.

## 2. Décisions fermes de l'utilisateur — ne pas revenir dessus sans demande

1. **Node.js 24 LTS — et PAS Node.js 26.** L'utilisateur a explicitement corrigé la recommandation précédente : il veut Node **24**. Conserver `.nvmrc` à `24`, `package.json` avec `engines.node` compatible 24, et Node 24 en CI/Vercel. Ne pas proposer ni appliquer une migration vers Node 26 sans nouvelle demande explicite.
2. **pnpm workspaces + Turborepo**, pas npm/yarn comme gestionnaire principal. Le starter indique `packageManager: "pnpm@12.15.0"` ; vérifier la version réellement utilisée avant de changer le moteur de package management.
3. **BiomeJS seul** pour lint, formatage et organisation des imports : le professeur a confirmé que cela suffit. **Ne pas ajouter ESLint, Prettier ou leurs configurations**.
4. **Aucun Docker/Docker Compose** : l'utilisateur a explicitement abandonné Docker. Développement local Node/pnpm et MongoDB Atlas ; production Vercel + Atlas.
5. **Les tests sont exclusivement dans des dossiers `tests/` séparés du code source dans les DEUX applications.** Ne PAS colocaliser les tests dans `src/` ni générer des `*.test.ts[x]` à côté des composants ou modules. Chemins : `apps/web/tests/**` et `apps/api/tests/**`.
6. **HTTP polling**, pas de WebSockets, Socket.IO, WebRTC ni connexion persistante pour le MVP ; pas de long-polling qui bloque une fonction Vercel. Pas de Redis nécessaire pour le MVP.
7. **MongoDB Atlas + Mongoose** ; ne pas se fier à une mémoire de processus pour conserver un matchmaking, des rounds, des sessions de jeu ou le score Elo.
8. **Monorepo feature-first**, frontend et backend distincts, contrats partagés dans `packages/shared`.
9. Ne pas installer de dépendances supplémentaires « parce que c'est standard » : justifier les ajouts et conserver une stack simple.

## 3. Stack technique arrêtée

### Frontend — `apps/web`

- React + TypeScript + Vite.
- Tailwind CSS **v4**, composants UI locaux compatibles avec l'écosystème **shadcn/ui**, composants Radix si besoin ; Lucide React pour les icônes.
- **TanStack Router** avec routing basé sur les fichiers `src/routes/` et génération de `routeTree.gen.ts` par le plugin Vite.
- **TanStack Query** pour requêtes, cache et polling ; `fetch` natif pour l'API (`src/lib/api-client.ts`), sans Axios par défaut.
- Zod pour la validation et les contrats partagés ; pas de duplication des schémas si `@shifu/shared` convient.
- Jest + Testing Library + SWC pour tests frontend, dans `apps/web/tests/`.

### Backend — `apps/api`

- Node.js **24**, Express **5**, TypeScript.
- MongoDB Atlas + Mongoose ; authentification par JWT et mots de passe hachés avec bcrypt.
- Zod (validation), Helmet, CORS, `express-rate-limit` et documentation OpenAPI/Swagger.
- Jest + Supertest + `@swc/jest` dans `apps/api/tests/`.
- `src/app.ts` construit l'application Express sans `listen()` ; `src/server.ts` lance le serveur local ; `src/index.ts` exporte l'app pour Vercel. Préserver cette séparation.
- `express-rate-limit` en mémoire est seulement une mesure locale/par instance ; il n'est **pas** distribué entre plusieurs fonctions Vercel. Ne pas le décrire comme une protection globale garantie.

### Monorepo

- `apps/web` : application web.
- `apps/api` : API Express.
- `packages/shared` : types TS, schémas Zod, constantes de jeu ; dépendances locales en `workspace:*`.
- `pnpm-workspace.yaml` et `turbo.json` à la racine ; `biome.json` commun ; CI GitHub Actions ; Vercel (2 projets) ; MongoDB Atlas externe.
- TypeScript du package shared exporte actuellement le code source via `exports: { ".": "./src/index.ts" }` (package JIT). Vérifier la compatibilité avec Jest, Vite, Vercel et TypeScript, sans casser les imports.

## 4. Arborescence et principes d'architecture

```text
shifu-me/
├── AGENTS.md                          # Ce document, à versionner
├── .nvmrc                             # 24 (décision explicite)
├── .npmrc                             # save-exact=true
├── .gitattributes                     # Normalisation des fins de ligne
├── .github/workflows/ci.yml
├── .vscode/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/ui/         # Composants UI réutilisables
│   │   │   ├── components/layout/
│   │   │   ├── features/              # auth, game, matchmaking, leaderboard, profile
│   │   │   ├── routes/                # Routes TanStack, fichiers de route
│   │   │   ├── lib/                   # API fetch, TanStack Query, utilitaires
│   │   │   └── index.css
│   │   ├── tests/                      # unit/, integration/ si besoin, setup.ts
│   │   ├── vite.config.ts
│   │   └── components.json
│   └── api/
│       ├── src/
│       │   ├── config/               # Connexion Mongoose
│       │   ├── middleware/           # auth, database, errors...
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── matchmaking/
│       │   │   ├── game/
│       │   │   └── leaderboard/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   └── index.ts
│       ├── tests/unit/
│       ├── tests/integration/
│       └── openapi/openapi.json
├── packages/shared/src/{constants,schemas,types}/
├── docs/
├── biome.json
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

**Organisation souhaitée pour une nouvelle fonctionnalité web :** composants spécifiques, hooks et accès API dans `src/features/<nom>/` ; composants vraiment transverses dans `src/components/`; définition des URLs/pages dans `src/routes/`. Pour le backend : `modules/<nom>/` avec `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.model.ts` lorsque pertinents ; flux routes → controllers → services → models. Ne pas créer des fichiers vides pour satisfaire artificiellement une architecture.

**Tests :** garder les fichiers `tests/` séparés ; les tests unitaires visent les règles et services, les tests d'intégration visent le contrat HTTP via Supertest ; mock ou base de test dédiée, **jamais** la base de production. Les fichiers Jest existants ont des `testMatch` ciblant les dossiers `tests/`.

## 5. Spécifications métier impératives

### 5.1 Match BO5

- Le **premier joueur à gagner 3 rounds** gagne le match (« best of 5 » au sens de 3 manches gagnantes ; les égalités peuvent entraîner plus de 5 rounds joués).
- Chaque round a une fenêtre de **10 secondes** déterminée par l'horloge **du serveur** : enregistrer `roundStartsAt`/`roundEndsAt`, ne jamais faire confiance à un chrono client pour valider un coup.
- Les coups possibles sont `rock`, `paper`, `scissors`, définis dans `packages/shared/src/schemas/game.ts`.
- Règles : pierre bat ciseaux, ciseaux battent feuille, feuille bat pierre.
- Deux coups identiques : **TIE**, aucun point ; recommencer un round.
- Un seul joueur n'a pas soumis de coup dans le délai : son adversaire gagne le round par forfait (simple AFK).
- Aucun des deux n'a soumis de coup : **BOTH_AFK**, aucun point et incrément du compteur `consecutiveBothAfk`.
- À **5 BOTH_AFK consécutifs**, annuler le match (`CANCELLED`) : **aucune variation Elo et aucune entrée dans l'historique visible**. Remettre à zéro le compteur après un round qui n'est pas BOTH_AFK (les cinq doivent être consécutifs).
- Ne pas confondre « absence de coup » et simple absence de polling/réseau : le critère final doit reposer sur l'état serveur enregistré à la deadline ; l'API doit supporter une latence raisonnable et expliciter les cas limites.

### 5.2 Coup caché, cohérence et concurrence

- Un joueur peut mettre à jour son choix tant que le serveur accepte la requête **avant `roundEndsAt`** ; le **dernier choix accepté côté serveur** doit être retenu.
- Un appel de soumission sauvegarde le choix et répond rapidement ; **ne pas maintenir la requête ouverte en attendant le deuxième joueur**.
- Ne jamais révéler le choix adverse à travers le polling ou tout autre endpoint tant que le round n'est pas officiellement résolu. Le détail de l'implémentation (choix stocké, hash/commitment éventuel) doit préserver cette propriété.
- Vérifier JWT, appartenance à la partie, statut du match, `roundId`, deadline et droit de modification pour chaque action ; ne jamais accepter l'ID de joueur du corps HTTP comme source d'autorité.
- Finalisation de round **atomique et idempotente**. Plusieurs joueurs ou pollings peuvent déclencher simultanément la résolution ; un seul résultat doit être pris en compte, aucun double score.
- Le compteur de score, l'historique et l'Elo sont **contrôlés exclusivement par le serveur**.
- Ne pas dépendre d'un `setTimeout()` serveur pour terminer une partie : sur Vercel, un processus peut être arrêté. Les transitions d'état doivent pouvoir être déclenchées de façon sûre lors de requêtes ultérieures et reposer sur des timestamps persistés.
- Toute écriture concurrente en matchmaking ou en partie doit utiliser des mises à jour MongoDB conditionnelles/atomiques, index appropriés et mécanismes idempotents ; pas de files en mémoire ni variables globales à valeur métier.

### 5.3 Elo et historique

- Chaque compte commence à **100 Elo**.
- **+10** pour le gagnant d'un **match** (et non d'un round), **−10** pour le perdant ; minimum **0** Elo.
- Statistiques de victoires/défaites et classement doivent rester cohérents avec les matchs conclus.
- En cas de match annulé par 5 doubles AFK consécutifs : aucun changement Elo et pas d'historique utilisateur.
- Une finalisation de match doit attribuer Elo/état/historique **une seule fois**, idéalement dans une transaction MongoDB ; Atlas fournit des replica sets. Tester la simultanéité, les répétitions de requêtes, les crashes et l'interruption réseau.

### 5.4 Polling HTTP

- Matchmaking : `GET /api/matchmaking/status` environ toutes les **1 000 ms** tant que l'utilisateur recherche un adversaire.
- Partie : `GET /api/game/:id/poll` environ toutes les **1 500 ms** pour l'état/temps/résultat, sans divulgation prématurée du coup adverse.
- Prévoir l'arrêt des pollings lorsque la page est quittée, la partie terminée ou l'utilisateur déconnecté ; gérer retries/backoff raisonnables et cache TanStack Query.
- Aucune WebSocket, SSE obligatoire ou WebRTC dans le MVP : l'architecture attendue est HTTP court.

Les constantes existantes sont dans `packages/shared/src/constants/game.ts` (`ROUND_DURATION_MS=10000`, `WINS_TO_VICTORY=3`, `MAX_CONSECUTIVE_BOTH_AFK=5`, `INITIAL_ELO=100`, `ELO_WIN=10`, `ELO_LOSS=10`, `MIN_ELO=0`, `MATCHMAKING_POLL_MS=1000`, `GAME_POLL_MS=1500`). Les réutiliser, éviter les nombres magiques.

## 6. Contrat API — implémenté vs à faire

**Routes présentes dans le starter (vérifier l'état du dépôt courant) :**

| Méthode | URL                      | Objet                                      |
| ------- | ------------------------ | ------------------------------------------ |
| GET     | `/api/health`            | Santé, sans MongoDB                        |
| GET     | `/api/openapi.json`      | Spécification OpenAPI                      |
| GET     | `/api/docs`              | Swagger UI                                 |
| POST    | `/api/auth/register`     | Création utilisateur, bcrypt, Elo 100, JWT |
| POST    | `/api/auth/login`        | Connexion, JWT                             |
| GET     | `/api/users/leaderboard` | Top 50, Elo décroissant                    |
| GET     | `/api/users/me`          | Profil authentifié                         |
| PUT     | `/api/users/me`          | Modification profil authentifié            |

**Routes prévues, NON implémentées dans le ZIP initial :**

| Méthode | URL                       | Objet                                                          |
| ------- | ------------------------- | -------------------------------------------------------------- |
| POST    | `/api/matchmaking/join`   | Entrer dans la file de recherche                               |
| GET     | `/api/matchmaking/status` | Attente et ID de partie une fois apparié                       |
| GET     | `/api/game/:id/poll`      | État serveur sécurisé, deadline et résultat visible            |
| POST    | `/api/game/:id/action`    | Soumettre/remplacer le coup du round                           |
| POST    | `/api/game/:id/resolve`   | Déclencher/récupérer une résolution idempotente après deadline |
| GET     | `/api/users/me/history`   | Matchs achevés du joueur                                       |

Le dessin narratif du cadrage mentionne aussi `GET /api/game/:id/result`, mais son tableau contractuel présente `/resolve`. **Ne pas créer deux variantes sans nécessité ; harmoniser le contrat avec `docs/api-roadmap.md`, les schémas Zod et le frontend avant implémentation.**

Validation des entrées par Zod ; erreurs API structurées (`{ error: { code, message } }`). Ajouter les nouveaux payloads, réponses et statuts à `packages/shared` puis synchroniser l'OpenAPI. Le contenu d'un token JWT doit être contrôlé et son secret chargé depuis l'environnement, jamais dans le frontend.

## 7. État connu du ZIP initial : existant et manquant

**Existant :** Vite/React, routing TanStack, première UI néo-brutaliste ; écrans d'inscription/connexion et leaderboard ; `apiFetch`, TanStack Query ; Express avec Helmet/CORS/limiteur local ; endpoints auth et user ; schémas Mongoose utilisateurs ; fonctions **pures** `resolveMoves`, `updatedElo`, `shouldCancelAfterBothAfk` ; tests Jest/Supertest ; Swagger/OpenAPI initial ; CI GitHub ; configurations Vercel.

**Encore manquant ou incomplet :** gestion de session durable dans le navigateur (les formulaires actuels montrent un message sans mémoriser le JWT) ; authentification côté UI et guard des routes ; matchmaking MongoDB et appariement atomique ; collections `game_sessions` et `matches` ; moteur BO5 persisté ; sélection des coups avec deadline serveur ; polling réellement branché sur les parties ; 5 doubles AFK intégrés à des rounds persistants ; transactions Elo + historique ; gestion avancée des cas limites ; tests d'intégration Mongo réels ; recette/validation de déploiement Vercel.

Ne jamais feindre que ces éléments sont en place. Les README de certaines `features/` et `modules/` sont actuellement des placeholders. Le backend `build` du starter est un **simple affichage** (`console.log(...)`), **pas une compilation Express** ; ne pas annoncer une compilation backend réussie sur cette base.

## 8. Identité visuelle et UX

Suivre la charte de `docs/documentation_de_cadrage_Shifu.me.md` : style **néo-brutaliste arcade**, contrastes forts, UI énergique, responsive et accessible.

| Usage                       | Couleur   |
| --------------------------- | --------- |
| Fond jaune « Cyber Yellow » | `#FFE600` |
| Succès/action vert menthe   | `#34D399` |
| Danger/défaite corail       | `#FB7185` |
| Cartes blanches             | `#FFFFFF` |
| Contours et ombres noirs    | `#000000` |
- Bordures noires de 3–4 px, ombres noires nettes décalées, coins modérément arrondis ; boutons avec léger effet d'enfoncement.
- Titres sans-serif très gras ; inspiration arcade sans sacrifier la lisibilité.
- Responsive mobile et desktop, états chargement/erreur/vide explicites, clavier/focus/labels, prise en compte de `prefers-reduced-motion`.
- Ne pas importer un autre design system en parallèle sans raison.

## 9. Biome — préférences précises exprimées par l'utilisateur

L'utilisateur a donné son `settings.json` VS Code et veut retrouver dans `biome.json` **tous les réglages pertinents côté lint/formatage**. Il souhaite :

- Formatter actif ; indentation **2 espaces**, pas de tabulations.
- Largeur de ligne demandée : **350**. Un échange précédent a indiqué une limite Biome à **320** ; vérifier la limite effectivement reconnue par la version installée et prendre **la valeur maximale autorisée la plus proche de 350**, sans créer une configuration invalide.
- Linter actif, `rules.recommended: true`.
- Organisation des imports active (`assist.actions.source.organizeImports: "on"`).
- JavaScript/TypeScript : **guillemets simples**, **points-virgules toujours**, **virgules finales partout**, **parenthèses sur les paramètres de fonctions fléchées**.
- Fins de ligne **LF** ; ignorer les fichiers générés (`routeTree.gen.ts`), caches, distributions, coverage et `node_modules` si nécessaire.
- Conserver l'intégration VS Code : `editor.defaultFormatter: "biomejs.biome"`, `editor.formatOnSave: true` et corrections/organize imports on save dans les paramètres de l'éditeur (ceux-ci **ne sont pas** des clés `biome.json`).

**Écart connu :** le `biome.json` du ZIP initial utilise encore `javascript.formatter.quoteStyle: "double"`, ne fixe pas `lineWidth` ni `semicolons`, etc. Il est **à aligner** sur les préférences ci-dessus après avoir lu le fichier réellement présent. Ne pas confondre les préférences souhaitées et l'état existant. Supprimer `biome.inlineConfig` dans les settings VS Code personnels si le dépôt définit maintenant les règles communes ; ne pas modifier les réglages personnels globaux de l'utilisateur.

À préserver dans le projet : `.npmrc` (`save-exact=true`), `.nvmrc` (`24`), `.gitattributes` pour fins de ligne Git. Les réglages purement visuels/personnels VS Code (thème, polices, curseur, Discord, Copilot) n'ont pas vocation à être transposés dans Biome.

## 10. INCIDENT EN COURS — `latest`, pnpm install et builds approuvés

**Ceci est un problème utilisateur réel et PAS une tâche déjà accomplie.** Le ZIP initial a été généré sans `pnpm-lock.yaml` et avec beaucoup de dépendances déclarées à `"latest"` dans les quatre `package.json` (racine, web, api, shared). C'était un compromis de génération, **pas une bonne pratique à conserver**.

Sur Windows, l'utilisateur a exécuté `pnpm i && pnpm lint:fix`. L'installation a téléchargé environ 549 packages, mais s'est arrêtée sur `ERR_PNPM_IGNORED_BUILDS`. Dépendances citées par pnpm :

- `@parcel/watcher@2.6.0`
- `@scarf/scarf@1.4.0`
- `bcrypt@6.0.0`
- `unrs-resolver@1.12.2`

`esbuild` et `@swc/core` ont lancé leur postinstall ; le workspace du starter contient déjà `allowBuilds` pour ces deux packages. pnpm affiche aussi « Agent skills awaiting approval » pour `@tanstack/react-router` et `@tanstack/router-plugin` : **les approbations d'agent skills (`pnpm approve`) sont distinctes des scripts de build (`pnpm approve-builds`)** et non indispensables au fonctionnement standard.

La réponse précédente proposait `pnpm up -r --save-exact` pour résoudre les déclarations `latest`. **L'utilisateur a explicitement indiqué que cette commande N'A PAS MARCHÉ. Ne surtout pas la répéter comme solution certaine ni affirmer que les manifests sont maintenant corrigés.**

### Plan de résolution attendu si Codex travaille sur les dépendances

1. Inspecter **les quatre** `package.json` réels, `pnpm-workspace.yaml`, `.npmrc`, la version effective de `pnpm` et la présence/validité de `pnpm-lock.yaml`.
2. Diagnostiquer le **message d'erreur exact** de `pnpm up -r --save-exact` s'il est disponible, sans inventer sa cause. `latest` est un tag de résolution, pas une version figée : remplacer par des **numéros de version réels et compatibles** dans `dependencies` et `devDependencies`, en préservant `"workspace:*"` pour `@shifu/shared`.
3. Une méthode fiable peut être d'exploiter le lockfile existant et les versions réellement installées, puis de mettre à jour les manifests et régénérer le lockfile. Ne pas coder « latest » en version exacte de manière aveugle, ni choisir des versions au hasard. Si besoin, utiliser les métadonnées pnpm et la commande `pnpm add -E ... --filter ...` appropriée pour chaque workspace (en distinguant deps/devDeps).
4. Traiter `ERR_PNPM_IGNORED_BUILDS` suivant les **mécanismes exacts de la version pnpm installée**. Examens et approbations ciblées via `pnpm approve-builds` ; autoriser uniquement les scripts nécessaires et dignes de confiance. `bcrypt` peut nécessiter un script natif. `@scarf/scarf` est lié à de la télémétrie, pas au fonctionnement métier ; ne pas approuver sans justification. Vérifier la syntaxe de la CLI, plutôt que copier sans contrôle une commande antérieure qui passait plusieurs arguments.
5. Ne pas cacher les erreurs avec des options de sécurité globales risquées. Commettre les décisions pnpm de scripts autorisés/refusés dans `pnpm-workspace.yaml` selon le schéma de la version installée.
6. Exécuter `pnpm install` puis `pnpm install --frozen-lockfile`, `pnpm lint:fix`, `pnpm check`, et rapporter précisément les résultats. Faire vérifier les incompatibilités possibles, notamment **TypeScript 7.0.2**, **Vite/Rolldown**, plugin TanStack, Jest et SWC : ces versions proviennent du `latest` du jour, elles ne sont **pas** une sélection de compatibilité validée.
7. Versionner `pnpm-lock.yaml` dans Git avec les manifests corrigés. En CI utiliser `pnpm install --frozen-lockfile`. Ne pas affirmer qu'un lockfile existe si le dépôt n'en a pas.

**À noter :** le fait que `pnpm install` ait téléchargé les paquets ne garantit pas que `pnpm lint:fix`, `pnpm check`, les tests ou la CI aient été exécutés avec succès. Les installations peuvent être bloquées avant l'exécution du deuxième terme de `&&`.

## 11. Scripts utiles et vérifications

Depuis la racine du monorepo (PowerShell/Git Bash selon le poste) :

```bash
node --version                  # Doit indiquer Node 24.x
pnpm --version                  # Vérifier la version réellement utilisée
pnpm install                    # Installer les 4 workspaces
pnpm approve-builds             # Si scripts d'installation bloqués
pnpm dev                        # Web + API
pnpm --filter @shifu/web dev    # Web seul
pnpm --filter @shifu/api dev    # API seule
pnpm lint                       # Biome check
pnpm lint:fix                   # Biome check --write
pnpm format                     # Biome format --write
pnpm build                      # Génère notamment l'arbre des routes TanStack
pnpm typecheck                  # TypeScript ; d'abord build si routeTree absent
pnpm test                       # Jest des 2 apps
pnpm check                      # lint + build + types + tests
pnpm install --frozen-lockfile  # Reproductibilité après lockfile validé
pnpm outdated -r                # Versions disponibles
```

En local : web `http://localhost:5173`, API `http://localhost:3000`, health `http://localhost:3000/api/health`, Swagger `http://localhost:3000/api/docs`, OpenAPI `http://localhost:3000/api/openapi.json`.

Initialiser des variables locales **sans secrets dans Git** :

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Configurer dans `apps/api/.env` `MONGODB_URI` (Atlas), `JWT_SECRET` (fort et unique), `FRONTEND_URL=http://localhost:5173`, `PORT=3000`, `JWT_EXPIRES_IN`. Dans `apps/web/.env.local` : `VITE_API_URL=http://localhost:3000`. Les variables `VITE_*` sont exposées au navigateur : **ne jamais y mettre `JWT_SECRET` ni `MONGODB_URI`**.

**Ordre initial pertinent :** installations, résolution des problèmes de scripts et de dépendances, alignement Biome, `pnpm lint:fix`, `pnpm build`, `pnpm typecheck`, `pnpm test`. Corriger réellement les erreurs avant de dire que le projet démarre. Préserver/adapter les tests lorsqu'une API change.

## 12. Git, GitHub, CI et déploiement

### Collaboration Git

- **GitHub Flow** : `main` + branches `feat/...`, `fix/...`, `chore/...`, `docs/...` ; pas de `develop` par défaut.
- Une PR par fonctionnalité, au moins une review, CI verte, squash merge, suppression des branches mergées, éviter les pushes directs sur `main`.
- Conventional Commits : `feat(game): ...`, `fix(auth): ...`, `chore: ...`.
- Partager les schémas et types Zod avant d'implémenter en parallèle des fonctionnalités qui consomment les mêmes contrats.
- `AGENTS.md`, `.nvmrc`, `.npmrc`, `.gitattributes`, les manifests et `pnpm-lock.yaml` appartiennent au dépôt. Ne pas inclure `.env`, `.env.local`, secrets, tokens et artefacts générés.

### CI

- `.github/workflows/ci.yml` doit installer **Node 24** et pnpm compatible, effectuer `pnpm install --frozen-lockfile`, puis lint, build, typecheck et tests.
- Le starter inclut certaines versions d'actions GitHub spécifiques (`actions/checkout@v7`, `pnpm/setup@v3`) : **vérifier qu'elles existent et sont compatibles** avant de s'appuyer dessus ; ne pas considérer la CI comme validée tant qu'un workflow réel n'a pas réussi.
- Viser un check CI déterministe à chaque PR, sans dépendance à une base de production.

### Vercel + Atlas

- Deux projets Vercel reliés au même dépôt, root dirs : `apps/web` (Vite) et `apps/api` (Express exporté sans `listen`). Tester la résolution du package workspace `@shifu/shared` depuis chaque projet.
- Atlas est externe à Vercel ; connexions MongoDB réutilisées lorsque possible sur une instance chaude, ne pas dépendre de RAM/processus durables. Tester le fonctionnement avec des fonctions serverless.
- Env prod : `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL` côté API ; `VITE_API_URL` côté web. Configurer correctement CORS, les accès réseau Atlas et les règles de réécriture SPA.
- Vérifier **les runtimes Node réellement pris en charge par Vercel** ; la préférence de projet reste Node **24**. Ne pas migrer vers 26 à cause d'une hypothèse de support.
- Les limites éventuelles de collaboration Vercel Hobby avec dépôt privé doivent être vérifiées au moment du déploiement.

## 13. Sécurité et qualité obligatoires

- Hacher les mots de passe avec bcrypt, jamais de mot de passe ou hash dans les réponses API ni dans les logs.
- Ne pas exposer `JWT_SECRET`, DB URI ou clé sensible au navigateur ni les committer.
- Valider les entrées via Zod ; appliquer authentification et contrôles d'appartenance sur chaque ressource privée.
- Utiliser des erreurs HTTP cohérentes et ne pas exposer des stacks d'erreurs en production.
- Auth client : **stratégie de stockage du JWT encore à concevoir** ; ne pas supposer que le starter implémente une session. Examiner les implications XSS/CSRF et l'architecture frontend/backend avant de choisir entre cookie HttpOnly et autres solutions.
- Mongoose : contraintes/index uniques sur usernames, précautions de concurrence, transitions d'état atomiques, transactions Elo.
- Tests des cas limites : égalités multiples, choix changeant juste avant la deadline, un AFK, deux AFK, cinquième double AFK consécutif, double résolution, refresh, déconnexion, appels concurrents, Elo 0, requêtes non authentifiées, un même joueur apparié deux fois.
- Éviter les modifications hors périmètre ; privilégier les petits changements vérifiables, sans refonte inutile.

## 14. Fonctionnalités à prioriser (cadrage MoSCoW)

**MUST :** inscription/auth, 100 Elo initial, matchmaking automatique avec polling, sessions persistées, moteur BO5 serveur 10 s, égalités rejouées, un AFK/les deux AFK, annulation 5 doubles AFK consécutifs, Elo ±10 minimum 0, jeu sans triche.

**SHOULD :** page d'accueil avec top 3 dynamique, classement général avec pagination et statistiques, historique de matchs, UI responsive aboutie.

**COULD :** sons rétro 8-bit via Web Audio, console debug HTTP, titres honorifiques selon Elo.

**EXCLUS du MVP :** WebSockets/WebRTC, microtransactions, achats intégrés, Docker.

## 15. Mode de travail de Codex

Avant chaque tâche significative :
1. Lire ce fichier, puis les documents `docs/` pertinents et les sources réellement touchées. Si l'environnement n'est pas exactement le starter, **l'inspecter** : l'utilisateur a peut-être déjà changé des fichiers depuis la création du ZIP.
2. Conserver les décisions explicitement fixées (particulièrement **Node 24**, **Biome seul**, **aucun Docker**, **tests séparés**).
3. Identifier ce qui est réellement implémenté, manquant ou cassé ; ne pas inventer des tests passés, versions compatibles ou fonctionnalités.
4. Pour un changement métier, préciser les invariants, créer/mettre à jour les schémas partagés, puis le serveur, les tests et le frontend si la tâche le requiert.
5. Exécuter les validations réalisables ; rapporter les commandes réellement lancées et leurs résultats, et signaler explicitement ce qui n'a pas pu être testé (Atlas, accès réseau, Vercel, etc.).
6. Mettre à jour la documentation lorsqu'une décision technique ou un contrat API évolue.
7. Ne pas élargir le périmètre ni remplacer les choix techniques de l'utilisateur sans explication et accord.

### Priorités concrètes actuelles (point de reprise)

1. **Régler l'installation pnpm et `ERR_PNPM_IGNORED_BUILDS`**, en gardant une politique d'approbation ciblée ; vérifier la sortie réelle.
2. **Éliminer les déclarations `"latest"`** des `package.json` avec des versions exactes compatibles ; `pnpm up -r --save-exact` a échoué chez l'utilisateur, donc diagnostiquer au lieu de répéter la commande.
3. **Générer/vérifier et committer `pnpm-lock.yaml`** pour une CI déterministe.
4. **Aligner `biome.json` sur les préférences utilisateur** (single quotes, 2 espaces, ligne aussi longue que Biome permet, semicolons, trailing commas, arrow parentheses, imports et lint recommandés).
5. Exécuter **`pnpm check`**, résoudre les erreurs effectives, contrôler la compatibilité de TypeScript/Jest/TanStack/Vite et du package shared.
6. Ensuite seulement continuer les fonctionnalités prioritaires (sessions auth, matchmaking, BO5 persisté, Elo, historique) selon la demande du porteur de projet.

**Dernière clarification décisive de l'utilisateur : « non je veux node 24 ». Cette instruction prévaut sur toute recommandation antérieure en faveur de Node 26.**
