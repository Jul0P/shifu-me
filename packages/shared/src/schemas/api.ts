import { z } from 'zod';
import { avatarSchema } from './auth';
import { moveSchema } from './game';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export const gameParamsSchema = z.object({
  id: objectIdSchema,
});

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);

export const roomParamsSchema = z.object({
  code: roomCodeSchema,
});

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type Pagination = z.infer<typeof paginationSchema>;

export const publicUserSchema = z.object({
  id: objectIdSchema,
  username: z.string(),
  avatar: z.string(),
  elo: z.number().int().nonnegative(),
  stats: z.object({
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
  }),
});

export const authResponseSchema = z.object({
  user: publicUserSchema,
  token: z.string(),
  expiresAt: z.iso.datetime(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export const readyResponseSchema = z.object({
  status: z.literal('ready'),
  transactions: z.literal(true),
});

export const configResponseSchema = z.object({
  avatars: z.array(avatarSchema),
  roundDurationMs: z.number(),
  revealDurationMs: z.number(),
  winsToVictory: z.number(),
  matchmakingPollMs: z.number(),
  gamePollMs: z.number(),
});

export const lobbyResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('idle'),
  }),
  z.object({
    status: z.literal('searching'),
    joinedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  }),
  z.object({
    status: z.literal('waiting'),
    code: roomCodeSchema,
    expiresAt: z.iso.datetime(),
  }),
  z.object({
    status: z.literal('matched'),
    gameId: objectIdSchema,
  }),
]);

const roundResultSchema = z.object({
  id: objectIdSchema,
  roundNumber: z.number().int().positive(),
  player1Move: moveSchema.nullable(),
  player2Move: moveSchema.nullable(),
  outcome: z.enum(['PLAYER_1', 'PLAYER_2', 'TIE', 'BOTH_AFK']),
  resolvedAt: z.iso.datetime(),
});

const playerSchema = z.object({
  id: objectIdSchema,
  username: z.string(),
  avatar: z.string(),
  elo: z.number(),
  submitted: z.boolean(),
  connected: z.boolean(),
});

export const gameResponseSchema = z.object({
  id: objectIdSchema,
  status: z.enum(['PLAYING', 'COMPLETED', 'CANCELLED']),
  phase: z.enum(['CHOOSING', 'REVEAL', 'FINISHED']),
  serverTime: z.iso.datetime(),
  roomCode: roomCodeSchema.nullable(),
  side: z.enum(['PLAYER_1', 'PLAYER_2']),
  score: z.object({
    me: z.number(),
    opponent: z.number(),
  }),
  consecutiveBothAfk: z.number(),
  me: playerSchema.extend({
    move: moveSchema.nullable(),
  }),
  opponent: playerSchema,
  round: z.object({
    id: objectIdSchema,
    number: z.number(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  }),
  lastResult: roundResultSchema.nullable(),
  finish: z
    .object({
      winnerId: objectIdSchema.nullable(),
      myDelta: z.number(),
      myElo: z.number(),
      opponentElo: z.number(),
      finishedAt: z.iso.datetime(),
    })
    .nullable(),
});

export const leaderboardResponseSchema = z.object({
  items: z.array(
    publicUserSchema.extend({
      rank: z.number(),
      winRate: z.number(),
    }),
  ),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
});

export const historyResponseSchema = z.object({
  items: z.array(
    z.object({
      id: objectIdSchema,
      gameId: objectIdSchema,
      opponent: publicUserSchema,
      myScore: z.number(),
      opponentScore: z.number(),
      won: z.boolean(),
      eloDelta: z.number(),
      eloBefore: z.number(),
      eloAfter: z.number(),
      finishedAt: z.iso.datetime(),
      roomCode: roomCodeSchema.nullable(),
    }),
  ),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
});

export const roundsResponseSchema = z.object({
  items: z.array(roundResultSchema),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
});

export type GameResponse = z.infer<typeof gameResponseSchema>;

export type LobbyResponse = z.infer<typeof lobbyResponseSchema>;
