import { z } from 'zod';
import { AVATARS } from '../constants/game';

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const avatarSchema = z.enum(AVATARS);
// bcrypt only processes the first 72 UTF-8 bytes. Reject longer passwords rather than silently truncate.

export const passwordSchema = z
  .string()
  .min(12, 'Le mot de passe doit contenir au moins 12 caractères.')
  .max(72, 'Le mot de passe est trop long.')
  .regex(/\p{Lu}/u, 'Ajoute au moins une majuscule au mot de passe.')
  .regex(/\p{Ll}/u, 'Ajoute au moins une minuscule au mot de passe.')
  .regex(/[0-9]/, 'Ajoute au moins un chiffre au mot de passe.')
  .regex(/[\p{P}\p{S}]/u, 'Ajoute au moins un caractère spécial au mot de passe.')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'Le mot de passe est trop long.');

export const registerSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    avatar: avatarSchema.optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    username: usernameSchema,
    password: z
      .string()
      .min(1)
      .max(72, 'Le mot de passe est trop long.')
      .refine((value) => new TextEncoder().encode(value).length <= 72, 'Le mot de passe est trop long.'),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    avatar: avatarSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Aucun champ à modifier');

export const deleteAccountSchema = z.object({ password: loginSchema.shape.password }).strict();
