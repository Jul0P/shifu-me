import { objectIdSchema } from '@shifu/shared';
import { z } from 'zod';

const STORAGE_KEY = 'shifu.session';
const sessionSchema = z.object({ token: z.string().min(1), userId: objectIdSchema, expiresAt: z.iso.datetime() });

export type Session = z.infer<typeof sessionSchema>;

export function readSession(): Session | null {
  try {
    const result = sessionSchema.safeParse(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'));

    return result.success && Date.parse(result.data.expiresAt) > Date.now() ? result.data : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Blocked storage still allows an in-memory session until the page is refreshed.
  }
}
