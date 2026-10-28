import { errorResponseSchema } from '@shifu/shared';
import type { z } from 'zod';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const authEvents = new EventTarget();

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export type ApiOptions = RequestInit & { token?: string };

export async function apiFetch<T>(path: string, { token, ...options }: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const timeout = AbortSignal.timeout(12_000);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    cache: 'no-store',
    credentials: 'omit',
  });

  if (!response.ok) {
    const body = errorResponseSchema.safeParse(await response.json().catch(() => null));

    if (response.status === 401 && token) {
      authEvents.dispatchEvent(new CustomEvent('expired', { detail: token }));
    }

    throw new ApiError(response.status, body.success ? body.data.error.code : 'HTTP_ERROR', body.success ? body.data.error.message : `Le serveur a répondu avec une erreur (${response.status}).`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError(502, 'INVALID_RESPONSE', 'La réponse du serveur est invalide. Réessaie dans un instant.');
    }

    throw error;
  }
}

export async function apiRequest<T>(path: string, schema: z.ZodType<T>, options?: ApiOptions): Promise<T> {
  const result = schema.safeParse(await apiFetch<unknown>(path, options));

  if (!result.success) {
    throw new ApiError(502, 'INVALID_RESPONSE', 'La réponse du serveur est invalide. Réessaie dans un instant.');
  }

  return result.data;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'Le serveur met trop de temps à répondre. Réessaie.';
  }

  return 'Connexion impossible. Vérifie ton réseau puis réessaie.';
}
