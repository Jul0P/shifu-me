import { z } from 'zod';
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const registerSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(8).max(128),
  })
  .strict();
export const loginSchema = registerSchema;
export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    avatar: z.string().trim().min(1).max(12).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Aucun champ à modifier');
