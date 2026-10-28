import type { z } from 'zod';
import type { authResponseSchema, publicUserSchema } from '../schemas/api';

export type PublicUser = z.infer<typeof publicUserSchema>;

export type AuthResponse = z.infer<typeof authResponseSchema>;
