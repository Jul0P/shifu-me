import { z } from 'zod';

export const moveSchema = z.enum(['rock', 'paper', 'scissors']);

export const submitMoveSchema = z
  .object({
    roundId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .toLowerCase(),
    move: moveSchema,
  })
  .strict();

export type Move = z.infer<typeof moveSchema>;
