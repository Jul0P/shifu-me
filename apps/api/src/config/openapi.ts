import * as contracts from '@shifu/shared';
import { z } from 'zod';

// Les formes HTTP viennent des contrats Zod partagés ; les routes et leurs descriptions restent explicites.
const definitions = {
  Register: contracts.registerSchema,
  Login: contracts.loginSchema,
  UpdateProfile: contracts.updateProfileSchema,
  DeleteAccount: contracts.deleteAccountSchema,
  MoveSubmission: contracts.submitMoveSchema,
  PublicUser: contracts.publicUserSchema,
  AuthResponse: contracts.authResponseSchema,
  Error: contracts.errorResponseSchema,
  Health: contracts.healthResponseSchema,
  Ready: contracts.readyResponseSchema,
  Config: contracts.configResponseSchema,
  Lobby: contracts.lobbyResponseSchema,
  Game: contracts.gameResponseSchema,
  Leaderboard: contracts.leaderboardResponseSchema,
  History: contracts.historyResponseSchema,
  Rounds: contracts.roundsResponseSchema,
};

const schemas = Object.fromEntries(
  Object.entries(definitions).map(([name, schema]) => {
    const converted = z.toJSONSchema(schema);
    delete converted.$schema;

    // La contrainte refine de Zod n'est pas convertie automatiquement en JSON Schema.
    if (name === 'UpdateProfile') {
      converted.minProperties = 1;
    }

    return [name, converted];
  }),
);

type SchemaName = keyof typeof definitions;

// Construit une référence vers un schéma nommé de la spécification OpenAPI.
const ref = (name: SchemaName) => ({
  $ref: `#/components/schemas/${name}`,
});

// Décrit un contenu application/json à partir de son schéma OpenAPI.
const json = (name: SchemaName) => ({
  'application/json': {
    schema: ref(name),
  },
});

interface Endpoint {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  id: string;
  tag: string;
  summary: string;
  response?: SchemaName;
  body?: SchemaName;
  auth?: boolean;
  status?: number;
  pagination?: boolean;
  description?: string;
}

const endpoints: Endpoint[] = [
  {
    method: 'get',
    path: '/api/health',
    id: 'health',
    tag: 'System',
    summary: 'Santé sans connexion MongoDB',
    response: 'Health',
  },
  {
    method: 'get',
    path: '/api/ready',
    id: 'ready',
    tag: 'System',
    summary: 'Vérifier MongoDB, les index et le support des transactions',
    response: 'Ready',
  },
  {
    method: 'get',
    path: '/api/config',
    id: 'config',
    tag: 'System',
    summary: 'Constantes et avatars du jeu',
    response: 'Config',
  },
  {
    method: 'post',
    path: '/api/auth/register',
    id: 'register',
    tag: 'Auth',
    summary: 'Créer un compte à 100 Elo et une session JWT',
    body: 'Register',
    response: 'AuthResponse',
    status: 201,
    description: 'Pseudo de 3 à 24 caractères, unique sans distinction de casse. Mot de passe d’au moins 12 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial ; maximum 72 octets UTF-8. Avatar optionnel. Champs inconnus refusés.',
  },
  {
    method: 'post',
    path: '/api/auth/login',
    id: 'login',
    tag: 'Auth',
    summary: 'Ouvrir une session JWT révocable',
    body: 'Login',
    response: 'AuthResponse',
    description: 'La connexion conserve les mots de passe existants sans imposer la complexité d’inscription. La limite de 72 octets UTF-8 reste appliquée.',
  },
  {
    method: 'post',
    path: '/api/auth/logout',
    id: 'logout',
    tag: 'Auth',
    summary: 'Révoquer la session courante',
    auth: true,
    status: 204,
  },
  {
    method: 'get',
    path: '/api/users/me',
    id: 'me',
    tag: 'Users',
    summary: 'Profil courant',
    response: 'PublicUser',
    auth: true,
  },
  {
    method: 'put',
    path: '/api/users/me',
    id: 'updateMe',
    tag: 'Users',
    summary: 'Modifier pseudo et/ou avatar',
    body: 'UpdateProfile',
    response: 'PublicUser',
    auth: true,
    description: 'Au moins un champ modifiable est obligatoire. Un objet vide ou contenant des champs réservés au serveur est refusé.',
  },
  {
    method: 'delete',
    path: '/api/users/me',
    id: 'deleteMe',
    tag: 'Users',
    summary: 'Supprimer définitivement son compte',
    body: 'DeleteAccount',
    auth: true,
    status: 204,
    description:
      'Mot de passe actuel obligatoire. Révoque toutes les sessions et retire le compte du classement. Nettoie les réservations et salles ; les matchs terminés sont conservés pour les adversaires avec un profil anonymisé. Refus 403 INVALID_PASSWORD si le mot de passe est incorrect ; 409 ACTIVE_GAME tant qu’une partie est en cours. Suppression transactionnelle, sérialisée avec le matchmaking.',
  },
  {
    method: 'get',
    path: '/api/users/leaderboard',
    id: 'leaderboard',
    tag: 'Users',
    summary: 'Classement paginé (limit=3 pour le podium)',
    response: 'Leaderboard',
    pagination: true,
    description: 'Tri Elo décroissant, victoires décroissantes, ObjectId croissant. winRate en pourcentage 0–100. Les égalités Elo reçoivent des positions distinctes.',
  },
  {
    method: 'get',
    path: '/api/users/me/history',
    id: 'history',
    tag: 'Users',
    summary: 'Matchs terminés, du plus récent au plus ancien',
    response: 'History',
    auth: true,
    pagination: true,
    description: 'Les annulations ne figurent jamais ici. Les profils adverses sont des snapshots du début du match.',
  },
  {
    method: 'post',
    path: '/api/matchmaking/join',
    id: 'queueJoin',
    tag: 'Matchmaking',
    summary: 'Rechercher un adversaire ou retrouver sa réservation',
    response: 'Lobby',
    auth: true,
  },
  {
    method: 'get',
    path: '/api/matchmaking/status',
    id: 'queueStatus',
    tag: 'Matchmaking',
    summary: 'Polling toutes les 1000 ms et reprise de partie active',
    response: 'Lobby',
    auth: true,
    description: 'La file expire après 30 s sans polling ; le statut idle impose un nouveau POST join. Une partie active est renvoyée sous status=matched. Aucun bot.',
  },
  {
    method: 'delete',
    path: '/api/matchmaking/leave',
    id: 'queueLeave',
    tag: 'Matchmaking',
    summary: 'Quitter la file (idempotent)',
    response: 'Lobby',
    auth: true,
    description: 'Si un appariement a gagné la course, renvoie matched ; ne détruit jamais une partie.',
  },
  {
    method: 'post',
    path: '/api/rooms',
    id: 'roomCreate',
    tag: 'Rooms',
    summary: 'Créer une salle privée ou retrouver sa salle',
    response: 'Lobby',
    auth: true,
    description: 'Code de 4 caractères généré par crypto, valide 10 minutes. Les matchs privés ont les mêmes règles Elo que les matchs publics.',
  },
  {
    method: 'post',
    path: '/api/rooms/{code}/join',
    id: 'roomJoin',
    tag: 'Rooms',
    summary: 'Rejoindre une salle par code',
    response: 'Lobby',
    auth: true,
    description: 'POST explicite ; un GET ne peut pas inscrire un invité. Au plus deux joueurs. La répétition par un participant retourne la même partie.',
  },
  {
    method: 'get',
    path: '/api/rooms/{code}',
    id: 'roomStatus',
    tag: 'Rooms',
    summary: 'Polling de salle (créateur ou invité)',
    response: 'Lobby',
    auth: true,
  },
  {
    method: 'delete',
    path: '/api/rooms/{code}',
    id: 'roomDelete',
    tag: 'Rooms',
    summary: 'Fermer sa salle en attente',
    response: 'Lobby',
    auth: true,
  },
  {
    method: 'get',
    path: '/api/game/{id}/poll',
    id: 'gamePoll',
    tag: 'Game',
    summary: 'État serveur sécurisé, polling toutes les 1500 ms',
    response: 'Game',
    auth: true,
    description:
      'Fait avancer les manches expirées. Horaires ISO UTC ; serverTime permet d’estimer le décalage client. Le coup adverse est absent avant résolution. connected est indicatif, jamais le critère de forfait. phase=REVEAL : attendre round.startsAt (pause de 2600 ms). lastResult est la dernière manche résolue, y compris après passage à la suivante.',
  },
  {
    method: 'post',
    path: '/api/game/{id}/action',
    id: 'gameAction',
    tag: 'Game',
    summary: 'Verrouiller son premier choix avant la deadline',
    body: 'MoveSubmission',
    response: 'Game',
    auth: true,
    description:
      'Le roundId courant est obligatoire. Le premier choix accepté par MongoDB avant round.endsAt est définitif. Toute nouvelle soumission pour ce joueur et cette manche renvoie MOVE_LOCKED (409), même avec le même coup. Aucune grâce après deadline : anticiper la latence réseau. Soumettre ne termine jamais un round avant 10 s. Autres erreurs 409 : STALE_ROUND, ROUND_NOT_STARTED, ROUND_EXPIRED, GAME_FINISHED.',
  },
  {
    method: 'post',
    path: '/api/game/{id}/resolve',
    id: 'gameResolve',
    tag: 'Game',
    summary: 'Résoudre les deadlines expirées de manière idempotente',
    response: 'Game',
    auth: true,
    description:
      'Avant la deadline, renvoie simplement l’état masqué. Après : résultat, score et éventuelle finalisation transactionnelle Elo/historique. Aucun body nécessaire. Le polling peut déclencher la même transition. Les rounds manqués sont rattrapés depuis les deadlines persistées ; cinq doubles AFK consécutifs annulent sans historique.',
  },
  {
    method: 'get',
    path: '/api/game/{id}/rounds',
    id: 'gameRounds',
    tag: 'Game',
    summary: 'Résultats déjà résolus, paginés du plus récent au plus ancien',
    response: 'Rounds',
    auth: true,
    pagination: true,
  },
];

// Construit le document servi à la volée : aucun JSON généré sur disque à synchroniser.
const paths: Record<string, Record<string, unknown>> = {};
for (const e of endpoints) {
  const parameters = [];

  if (e.path.includes('{id}')) {
    parameters.push({
      name: 'id',
      in: 'path',
      required: true,
      schema: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{24}$',
      },
    });
  }

  if (e.path.includes('{code}')) {
    parameters.push({
      name: 'code',
      in: 'path',
      required: true,
      schema: {
        type: 'string',
        pattern: '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$',
      },
    });
  }

  if (e.pagination) {
    parameters.push({
      name: 'page',
      in: 'query',
      required: false,
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 100000,
        default: 1,
      },
    });
    parameters.push({
      name: 'limit',
      in: 'query',
      required: false,
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 20,
      },
    });
  }

  const responses: Record<string, unknown> = {
    [e.status ?? 200]: {
      description: 'Succès',
      ...(e.response
        ? {
            content: json(e.response),
          }
        : {}),
    },
  };

  for (const [status, description] of Object.entries({
    400: 'Entrée invalide',
    401: 'JWT/session absent, expiré ou révoqué',
    403: 'Ressource interdite',
    404: 'Ressource introuvable',
    409: 'Conflit ou action hors délai',
    413: 'Payload trop volumineux',
    415: 'Encodage du corps non pris en charge',
    429: 'Limite locale par instance atteinte',
    500: 'Erreur interne',
    503: 'Base ou configuration indisponible / replica set requis',
  })) {
    responses[status] = {
      description,
      content: json('Error'),
    };
  }
  paths[e.path] ??= {};
  paths[e.path][e.method] = {
    operationId: e.id,
    tags: [e.tag],
    summary: e.summary,
    description: e.description,
    security: e.auth
      ? [
          {
            bearerAuth: [],
          },
        ]
      : [],
    ...(parameters.length
      ? {
          parameters,
        }
      : {}),
    ...(e.body
      ? {
          requestBody: {
            required: true,
            content: json(e.body),
          },
        }
      : {}),
    responses,
  };
}

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Shifu.me API',
    version: '1.0.0',
    description:
      'API HTTP courte, Node 24 / Express 5 / MongoDB replica set. Auth Bearer JWT révocable. BO5 à 3 victoires, manches de 10 s, premier choix accepté verrouillé jusqu’à la prochaine manche. Aucun cookie imposé. Retirer la session côté client au logout et arrêter les pollings. Le limiteur mémoire n’est pas distribué sur Vercel.',
  },
  servers: [
    {
      url: '/',
    },
  ],
  tags: ['System', 'Auth', 'Users', 'Matchmaking', 'Rooms', 'Game'].map((name) => ({
    name,
  })),
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas,
  },
  paths,
};

export default openapi;
