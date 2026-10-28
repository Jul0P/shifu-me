import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/lib/api-client';
import { queryClient } from '../../src/lib/query-client';

describe('Politique de requêtes', () => {
  it('ne rejoue jamais automatiquement les mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });

  it('réessaie les erreurs réseau et serveur mais pas les erreurs client', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry;
    if (typeof retry !== 'function') {
      throw new Error('La politique de retry doit être explicite');
    }
    expect(retry(0, new TypeError('Réseau'))).toBe(true);
    expect(retry(0, new ApiError(503, 'UNAVAILABLE', 'Indisponible'))).toBe(true);
    expect(retry(2, new TypeError('Réseau'))).toBe(false);
    for (const status of [400, 401, 403, 404, 409, 429]) {
      expect(retry(0, new ApiError(status, 'CLIENT_ERROR', 'Refus'))).toBe(false);
    }
  });
});
