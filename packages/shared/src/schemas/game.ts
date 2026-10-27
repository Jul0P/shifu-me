import { z } from 'zod';
export const moveSchema = z.enum([
  'rock',
  'paper',
  'scissors',
]);
export const submitMoveSchema = z
  .object({
    roundId: z.string().min(1),
    move: moveSchema,
  })
  .strict();
export type Move = z.infer<typeof moveSchema>;
export const matchStatusSchema = z.enum([
  'WAITING',
  'PLAYING',
  'COMPLETED',
  'CANCELLED',
]);
export type MatchStatus = z.infer<typeof matchStatusSchema>;
