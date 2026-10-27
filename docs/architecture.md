# Architecture — Shifu.me

## Monorepo

- `apps/web` : React 19, Vite, TanStack Router, TanStack Query, Tailwind 4, composants UI locaux.
- `apps/api` : Express 5 (routes, middlewares, modules fonctionnels), JWT/bcrypt, Mongoose.
- `packages/shared` : contrats Zod, types et règles communes du BO5.
- `apps/web/tests` et `apps/api/tests` : tests séparés des sources, avec Jest ; Supertest pour l'API.

## Cycle HTTP (à implémenter)

1. Client authentifié : POST `/api/matchmaking/join`.
2. Client : GET `/api/matchmaking/status` toutes les 1 s tant qu'il attend.
3. Backend : rapproche deux joueurs via une mise à jour atomique MongoDB (jamais un tableau global en RAM).
4. Serveur : enregistre `roundEndsAt = date du serveur + 10 s`.
5. Clients : envoient leurs changements de choix pendant le chrono ; le backend répond sans attendre l'adversaire.
6. Clients : GET `/api/game/:id/poll` toutes les ~1,5 s seulement pendant une manche.
7. Dès l'expiration du temps, une opération serveur idempotente verrouille les coups, calcule le round et renvoie le résultat. Ne jamais ouvrir de POST qui reste en attente.
8. Après 3 rounds remportés, le match est terminé. L'Elo est mis à jour une seule fois par transaction MongoDB.

## Règles métier de référence

- 10 secondes par manche, chrono **serveur**.
- Signes égaux : égalité ; manche rejouée sans score.
- Un seul AFK : l'autre gagne la manche.
- Deux AFK : round nul ; à 5 doubles AFK **consécutifs**, match `CANCELLED`, sans historique ni Elo.
- Elo initial 100, match gagné +10, perdu -10, minimum 0.
- Pas de WebSockets, pas de Redis, pas de Docker dans le MVP.

## Points de sécurité

- L'API est l'autorité pour l'appartenance à une partie, les choix, les échéances, le score et l'Elo.
- Ne jamais révéler le coup adverse avant la résolution de la manche.
- Utiliser le dernier coup **accepté par le serveur** avant l'échéance ; ne pas faire confiance à l'horloge du navigateur.
- Prévenir la double résolution avec une écriture atomique conditionnelle et protéger l'Elo avec des écritures idempotentes/transactions.
- Identifiants pris depuis le JWT vérifié, jamais depuis le corps de la requête.
- Ne pas persister de JWT en localStorage sans décider explicitement du modèle de menace ; le starter n'implémente pas de persistance de session.

## Statut réel du code fourni

**Fonctionnel** : health, inscription, connexion (avec Atlas configuré), profil/édition, leaderboard, schémas partagés, résolution pure d'un round, tests API et UI, documentation OpenAPI.

**Non implémenté** : file de matchmaking, rounds persistants, délais, finalisation serveur, BO5 complet, Elo transactionnel, historique et persistance de session navigateur. Ne pas déployer comme un jeu compétitif fini.
