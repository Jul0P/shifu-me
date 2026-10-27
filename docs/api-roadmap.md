# API à développer après le bootstrap

Les routes ci-dessous sont **prévues par le document de cadrage Shifu.me**, elles ne sont **pas encore présentes** dans le serveur :

| Méthode | Chemin                    | Rôle                                      |
| ------- | ------------------------- | ----------------------------------------- |
| POST    | `/api/matchmaking/join`   | Entrer dans la file                       |
| GET     | `/api/matchmaking/status` | Polling 1s                                |
| GET     | `/api/game/:id/poll`      | État de partie, polling 1,5s              |
| POST    | `/api/game/:id/action`    | Soumettre/mettre à jour son choix         |
| POST    | `/api/game/:id/resolve`   | Résolution idempotente après l'expiration |
| GET     | `/api/users/me/history`   | Historique des matchs terminés            |

Avant de coder : définir les payloads Zod dans `packages/shared/src/schemas`, les états MongoDB, les critères AFK, les tests de concurrence et la politique d'expiration. Le backend ne doit pas attendre la réponse du second joueur en conservant une requête HTTP ouverte.
