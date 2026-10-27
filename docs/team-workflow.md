# Collaboration à quatre — GitHub Flow

Branche principale : `main`. Pas de branche `develop` pour l'instant. Utiliser une PR par fonctionnalité, CI verte et au moins une revue avant merge. Si un staging permanent devient nécessaire, créer `develop` à ce moment-là.

## Nommage

- Branches : `feat/auth`, `feat/matchmaking`, `feat/game-engine`, `feat/arena-ui`, `fix/round-timeout`, `docs/readme`.
- Commits : Conventional Commits (`feat(game): calculate round winner`, `fix(auth): reject expired JWT`).
- Fusion : squash, suppression de branche, pas de push direct sur `main`.

## Répartition suggérée

1. Auth, utilisateurs, JWT, base de données.
2. Matchmaking, moteur BO5 et cas limites.
3. UI globale, routage, authentification côté web.
4. Arène, polling HTTP, leaderboard et historique.

Définir ensemble les contrats Zod du package `shared` avant d'implémenter les routes associées.

## Exemple

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/matchmaking
# écrire du code, exécuter pnpm check
git add .
git commit -m "feat(matchmaking): add queue entry"
git push -u origin feat/matchmaking
gh pr create --base main --fill
```
