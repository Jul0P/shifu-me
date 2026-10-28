import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSession, type Session, saveSession } from '../../src/features/auth/session';
import { TOKEN, USER_ID } from '../helpers/data';

const session: Session = { token: TOKEN, userId: USER_ID, expiresAt: '2099-01-01T00:00:00.000Z' };

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

describe('Session de connexion locale', () => {
  it('restaure uniquement une session valide et non expirée', () => {
    saveSession(session);
    expect(readSession()).toEqual(session);
  });

  it('efface la session à la déconnexion', () => {
    saveSession(session);
    saveSession(null);
    expect(readSession()).toBeNull();
  });

  it.each(['null', '{json cassé', '{}', JSON.stringify({ ...session, userId: 'invalide' }), JSON.stringify({ ...session, token: '' }), JSON.stringify({ ...session, expiresAt: '2000-01-01T00:00:00.000Z' })])('ignore une session inutilisable : %s', (value) => {
    sessionStorage.setItem('shifu.session', value);
    expect(readSession()).toBeNull();
  });

  it('tolère un stockage bloqué sans faire planter le rendu', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new DOMException('Stockage bloqué', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('Stockage bloqué', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('Stockage bloqué', 'SecurityError');
      },
    });
    expect(readSession()).toBeNull();
    expect(() => saveSession(session)).not.toThrow();
    expect(() => saveSession(null)).not.toThrow();
  });
});
