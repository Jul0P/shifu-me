# Commandes du monorepo Shifu.me (PowerShell)

## Après avoir extrait le ZIP

```powershell
cd shifu-me
npm install -g pnpm@12.15.0
pnpm install --frozen-lockfile
pnpm lint:fix
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
# Reporter le secret dans apps/api/.env, puis configurer l'URI MongoDB Atlas
pnpm dev
```

## Développement

Les versions directes sont exactes dans les quatre manifests et les résolutions sont enregistrées dans `pnpm-lock.yaml`. Versionner ensemble manifests et lockfile après une mise à jour. `pnpm up -r --save-exact` n'est pas nécessaire pour l'installation initiale de cet état du projet.

Si PowerShell bloque `pnpm.ps1`, utiliser `pnpm.cmd` à la place de `pnpm`. Les scripts de build approuvés/refusés sont enregistrés dans `pnpm-workspace.yaml` ; les approbations d'agent skills sont distinctes.

```powershell
pnpm dev
pnpm --filter @shifu/web dev
pnpm --filter @shifu/api dev
pnpm lint
pnpm lint:fix
pnpm format
pnpm build
pnpm typecheck
pnpm test
pnpm test:watch
pnpm check
pnpm outdated -r
pnpm update -r --latest
pnpm approve-builds
```

## Composants shadcn/ui (à ajouter seulement quand nécessaires)

```powershell
pnpm --dir apps/web dlx shadcn@latest add dialog
pnpm --dir apps/web dlx shadcn@latest add avatar
pnpm --dir apps/web dlx shadcn@latest add sonner
```

La configuration `apps/web/components.json` est incluse ; le ZIP contient des composants compatibles créés pour le starter, pas le résultat d'une exécution vérifiée du CLI shadcn. Vérifier les changements générés avant commit.

## GitHub : nouveau dépôt avec GitHub CLI

```powershell
git init -b main
git add .
git commit -m "chore: initialize Shifu.me monorepo"
gh auth login
gh repo create shifu-me --private --source=. --remote=origin --push
```

## GitHub : dépôt créé dans le navigateur

```powershell
git init -b main
git add .
git commit -m "chore: initialize Shifu.me monorepo"
git remote add origin https://github.com/VOTRE_COMPTE/shifu-me.git
git push -u origin main
```

## GitHub : travail quotidien (quatre personnes)

```powershell
git switch main
git pull --ff-only origin main
git switch -c feat/arena-ui
pnpm check
git add .
git commit -m "feat(web): add arena layout"
git push -u origin feat/arena-ui
gh pr create --base main --fill
```

Pour inviter des membres : `gh repo edit --add-topic typescript --add-topic react` ajoute des topics, pas des collaborateurs. Utiliser **GitHub > Settings > Collaborators and teams** pour les invitations, ou gérer les accès depuis votre organisation.

## Vercel : option CLI

```powershell
pnpm dlx vercel@latest login
# Le dashboard Vercel est préférable pour créer deux projets avec Root Directory apps/web et apps/api.
```

## Serveurs

- Web : http://localhost:5173
- Health API : http://localhost:3000/api/health
- Swagger : http://localhost:3000/api/docs
- OpenAPI : http://localhost:3000/api/openapi.json

## Ne jamais committer

`.env`, `.env.local`, mot de passe MongoDB, JWT_SECRET, ni tokens personnels.
