# Shifu.me — Document de Cadrage & Spécifications Techniques

## 1. Problème résolu & Proposition de Valeur

### Le Problème

1. **Absence de format compétitif rapide :** La majorité des jeux en ligne demandent un investissement temps (15 à 45 minutes par partie) ou des mécaniques complexes.

2. **Litiges dans le jeu physique :** Le Chifoumi classique souffre des gestes décalés, des contestations de timing et de l'oubli du score.

3. **Manque de persistance :** Gagner une partie entre amis ou collègues ne laisse aucune trace chiffrée ou valorisante.

### La Solution apportée par Shifu.me

- Un micro-jeu d'arène sur navigateur, accessible en quelques clics sans installation.

- Un arbitrage strict et impartial via un serveur qui synchronise un compte à rebours de 10 secondes et révèle les coups simultanément.

- Une couche de rétention par l'Elo (départ 100, victoire +10, défaite -10, minimum 0), un classement mondial et un historique complet des affrontements en BO5.

## 2. Public Cible (Personas & Cas d'Usage)

### Persona A : « Thomas, 21 ans — L'Étudiant en pause »

- **Profil :** Toujours sur son smartphone ou son laptop entre deux cours d'amphi.

- **Usage :** Lance 2 ou 3 matchs rapides pour défier un camarade ou tuer 5 minutes.

- **Motivation :** L'ego du score Elo et chambrer ses amis dans le classement de la promo.

### Persona B : « Sarah, 29 ans — La Décideuse en entreprise »

- **Profil :** Travailleuse en agence ou open-space, adepte des rituels de pause-café.

- **Usage :** Utilise l'outil pour trancher les micro-décisions quotidiennes (« qui va chercher les sushis ? » ou « qui commence la présentation ? »).

- **Motivation :** L'impartialité totale du chrono et le format Best-Of-5 qui enlève la frustration d'un "coup de chance unique".

## 3. Identité Visuelle & Charte Graphique

Le parti pris visuel est un hommage aux bornes d'arcade pop, utilisant les codes du **Néo-brutalisme web** (forts contrastes, ombres dures, traits noirs prononcés).

### Palette de Couleurs

| Rôle                    | Nom / Référence   | Code Hexa | Description                                |
| ----------------------- | ----------------- | --------- | ------------------------------------------ |
| **Fond Principal**      | Cyber Yellow      | `#FFE600` | Jaune percutant, énergique et rétro        |
| **Action Principale**   | Emerald Mint      | `#34D399` | Boutons de validation et victoires         |
| **Danger / Défaites**   | Soft Coral / Rose | `#FB7185` | Perte d'Elo, alertes, chrono critique      |
| **Cartes & Conteneurs** | Stark White       | `#FFFFFF` | Contraste net pour la lisibilité           |
| **Traits & Ombres**     | Pure Black        | `#000000` | Bordures de `3px` à `4px` et ombres nettes |

### Typographie & Formes

- **Titres :** Typographie sans-serif ultra-bold / black (ex: _Archivo Black_, _Space Grotesk_ ou _Inter Black_), majuscules, tracking resserré.

- **Composants :** Bordures noires épaisses (`border: 3px solid #000`), coins légèrement adoucis (`border-radius: 8px` à `16px`), ombres décalées non floutées (`box-shadow: 4px 4px 0px #000`).

- **Micro-interactions :** Effet "press button" au clic (`transform: translate(2px, 2px)` avec réduction d'ombre à `2px 2px 0px #000`).

## 4. Règles Métier & Logique de Jeu

### 4.1. Structure du Match (BO5)

- Le match se dispute au **Best of 5** : le premier joueur à cumuler **3 victoires de round** remporte le match.

- À chaque round, un chronomètre serveur strict de **10 secondes** défile.

### 4.2. Résolution des Choix

1. **Égalité de signes (ex: Pierre vs Pierre) :**
   - Le round est rejoué.

   - **Aucun point n'est attribué.** Le score du BO reste inchangé.

   - La partie peut durer un nombre indéfini de rounds si les deux joueurs continuent de sélectionner le même signe.

2. **Déconnexion / Absence de choix d'un seul joueur (AFK simple) :**
   - Si le Joueur A choisit un signe et que le Joueur B est déconnecté ou n'a rien choisi à la fin des 10s : **Le Joueur A gagne le round par forfait**.

3. **Double Déconnexion / Double AFK (Round Nul) :**
   - Si les deux joueurs ne choisissent rien ou sont tous deux injoignables à la fin des 10s : le round est déclaré **Nul**.

   - Un compteur `consecutiveBothAfk` est incrémenté.

   - **Règle d'annulation automatique :** Si `consecutiveBothAfk >= 5` :
     - Le match s'arrête immédiatement.

     - **Aucun impact Elo** (+0 / -0 pour les deux joueurs).

     - La partie est **annulée et exclue de l'historique**.

### 4.3. Système de Classement Elo

- **Elo initial :** Tout utilisateur commence à **100 points**.

- **Gain par victoire de match :** `+10 points`.

- **Perte par défaite de match :** `-10 points`.

- **Plancher strict :** L'Elo ne peut jamais descendre sous **0** (`Math.max(0, elo - 10)`).

## 5. Architecture Technique (React + Express + MongoDB sans WebSocket)

### Contrainte Majeure : HTTP Polling

En l'absence de WebSocket, la synchronisation temps réel repose sur un schéma de **Short Polling** ou **Long Polling** avec un serveur Express faisant office d'horloge maîtresse.

```
+---------------+                              +---------------+
| Client React  |                              | Backend       |
| (Joueur A)    |                              | Express / BDD |
+-------+-------+                              +-------+-------+
        |                                              |
        |  1. POST /api/matchmaking/join               |
        +--------------------------------------------->| (Mise en file d'attente)
        |                                              |
        |  2. GET /api/matchmaking/status (toutes 1s)  |
        +--------------------------------------------->|
        |<---------------------------------------------+
        |  200 OK: { status: 'matched', gameId: 'xyz' }|
        |                                              |
        |  3. POST /api/game/:id/action (choix masqué) |
        +--------------------------------------------->| (Stocke le hash/choix)
        |                                              |
        |  4. GET /api/game/:id/poll (toutes 1.5s)     |
        +--------------------------------------------->| (Renvoie timer & lockedState)
        |<---------------------------------------------+
        |                                              |
        |  5. GET /api/game/:id/result (quand t = 0)   |
        +--------------------------------------------->| (Révèle les deux choix & vainqueur)
        |<---------------------------------------------+

```

### Modélisation MongoDB (Schémas Mongoose)

#### Collection `users`

```
{
  "_id": "ObjectId",
  "username": "MaxouLeRoc",
  "passwordHash": "string (bcrypt)",
  "avatar": "🪨",
  "elo": 120,
  "stats": {
    "wins": 6,
    "losses": 4
  },
  "createdAt": "ISODate"
}

```

#### Collection `matches`

```
{
  "_id": "ObjectId",
  "player1Id": "ObjectId(users)",
  "player2Id": "ObjectId(users)",
  "score": {
    "player1": 3,
    "player2": 1
  },
  "winnerId": "ObjectId(users)",
  "eloChange": 10,
  "status": "COMPLETED", // "COMPLETED" ou "CANCELLED"
  "createdAt": "ISODate"
}

```

#### Collection / Structure Mémoire `game_sessions` (Cache ou Mongo)

```
{
  "_id": "game_xyz",
  "player1": { "id": "u1", "choice": "rock", "locked": true, "lastSeen": "ISODate" },
  "player2": { "id": "u2", "choice": null, "locked": false, "lastSeen": "ISODate" },
  "roundNumber": 2,
  "roundStartTime": 1729950000000,
  "consecutiveBothAfk": 0,
  "score": { "p1": 1, "p2": 0 }
}

```

### Spécification des Endpoints REST

| Méthode | Route                     | Rôle                                                           |
| ------- | ------------------------- | -------------------------------------------------------------- |
| `POST`  | `/api/auth/register`      | Inscription, initialise l'Elo à 100                            |
| `POST`  | `/api/auth/login`         | Authentification, retourne un JWT                              |
| `PUT`   | `/api/users/me`           | Modification pseudo et avatar                                  |
| `GET`   | `/api/users/leaderboard`  | Top joueurs triés par `elo: -1`                                |
| `GET`   | `/api/users/me/history`   | Historique des matchs de l'utilisateur                         |
| `POST`  | `/api/matchmaking/join`   | Placement dans le pool d'attente                               |
| `GET`   | `/api/matchmaking/status` | Polling du statut de recherche                                 |
| `GET`   | `/api/game/:id/poll`      | Polling d'état du round en cours (tps restant, statut adverse) |
| `POST`  | `/api/game/:id/action`    | Soumission du coup du joueur (Pierre, Feuille ou Ciseaux)      |
| `POST`  | `/api/game/:id/resolve`   | Déclenchement / récupération du résultat à 0 seconde           |

## 6. Liste des Fonctionnalités & Priorisation (MoSCoW)

```
+-----------------------------------------------------------------------+
| MUST HAVE (P1 - Vital pour le livrable)                               |
| • Authentification JWT & Inscription avec 100 Elo de base.            |
| • Matchmaking automatique par file d'attente (HTTP polling).          |
| • Moteur de jeu BO5 avec compte à rebours 10s synchronisé serveur.    |
| • Gestion des égalités infinies (rejouer le round sans point).         |
| • Plancher d'Elo à 0 & mise à jour (+10 / -10).                      |
| • Règle des 5 doubles déconnexions (annulation sans historique).       |
+-----------------------------------------------------------------------+
| SHOULD HAVE (P2 - Complétude produit)                                 |
| • Page d'accueil publique avec Top 3 mondial dynamique.              |
| • Page Classement général complet avec pagination et ratios.          |
| • Page Historique des matchs de l'utilisateur.                       |
| • UI Néo-brutaliste responsive (Desktop & Mobile).                    |
+-----------------------------------------------------------------------+
| COULD HAVE (P3 - Bonus & polish)                                      |
| • Effets sonores rétro 8-bit générés au synthétiseur Web Audio.       |
| • Console de debug HTTP intégrée pour visualiser les requêtes.         |
| • Titres honorifiques selon l'Elo (ex: "Gladiateur du Papier").        |
+-----------------------------------------------------------------------+
| WON'T HAVE (Exclu du scope actuel)                                    |
| • Canaux WebSockets ou WebRTC.                                        |
| • Système d'achats in-game ou micro-transactions.                     |
+-----------------------------------------------------------------------+

```

## 7. Matrice de Répartition des Tâches (RACI)

Pour une équipe de développement en binôme ou trinôme (Profil A : Backend/Data, Profil B : Frontend/UI) :

| Tâche / Livrable                                         | Profil Backend (Node/Express/Mongo) | Profil Frontend (React/CSS) |
| -------------------------------------------------------- | ----------------------------------- | --------------------------- |
| **Schémas Mongoose & Hashage Bcrypt**                    | **R**esponsable                     | **I**nformé                 |
| **Logique de Matchmaking & File d'attente HTTP**         | **R**esponsable                     | **C**onsulté                |
| **Arbitrage des Rounds (Chrono 10s, BO5, 5x AFK)**       | **R**esponsable                     | **C**onsulté                |
| **Intégration Design Néo-brutaliste & Landing**          | **I**nformé                         | **R**esponsable             |
| **Composants d'Arène & Boucle de Polling Client**        | **C**onsulté                        | **R**esponsable             |
| **Écrans Leaderboard & Historique**                      | **C**onsulté                        | **R**esponsable             |
| **Recette des cas limites (Spam de clics, F5, Latence)** | **R**esponsable                     | **R**esponsable             |

_Légende : **R** = Réalise (fait le travail), **C** = Consulté (donne son avis technique), **I** = Informé (reçoit les spécifications)._
