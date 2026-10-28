import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Une requête réseau non simulée a été tentée dans un test unitaire.');
    }),
  );
});
