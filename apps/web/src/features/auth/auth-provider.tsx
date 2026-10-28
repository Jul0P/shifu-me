import { type AuthResponse, publicUserSchema } from '@shifu/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { apiFetch, apiRequest, authEvents } from '@/lib/api-client';
import { AuthContext } from './auth-context';
import { readSession, type Session, saveSession } from './session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [session, setSession] = useState<Session | null>(readSession);
  const [notice, setNotice] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ['profile', session?.userId],
    queryFn: ({ signal }) => apiRequest('/api/users/me', publicUserSchema, { token: session?.token, signal }),
    enabled: Boolean(session),
    staleTime: 30_000,
  });

  const clearSession = useCallback(() => {
    saveSession(null);
    setSession(null);
    client.clear();
  }, [client]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const expire = () => {
      clearSession();
      setNotice('Ta session a expiré. Reconnecte-toi pour continuer.');
    };
    const handleUnauthorized = (event: Event) => {
      if ((event as CustomEvent<string>).detail === session.token) {
        expire();
      }
    };
    let timer: number | undefined;
    const scheduleExpiration = () => {
      window.clearTimeout(timer);
      const remaining = Date.parse(session.expiresAt) - Date.now();

      if (remaining <= 0) {
        expire();
      } else {
        timer = window.setTimeout(scheduleExpiration, Math.min(remaining, 2_147_483_647));
      }
    };

    authEvents.addEventListener('expired', handleUnauthorized);
    window.addEventListener('focus', scheduleExpiration);
    scheduleExpiration();

    return () => {
      window.clearTimeout(timer);
      authEvents.removeEventListener('expired', handleUnauthorized);
      window.removeEventListener('focus', scheduleExpiration);
    };
  }, [session, clearSession]);

  const signIn = (response: AuthResponse) => {
    client.clear();
    const next = { token: response.token, userId: response.user.id, expiresAt: response.expiresAt };

    saveSession(next);
    client.setQueryData(['profile', next.userId], response.user);
    setSession(next);
    setNotice(null);
  };

  const signOut = async () => {
    const token = session?.token;

    clearSession();

    if (token) {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST', token });
      } catch {
        setNotice('Tu es déconnecté ici. Le serveur étant inaccessible, la session distante expirera automatiquement.');
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: session ? (profile.data ?? null) : null,
        token: session?.token,
        isLoading: Boolean(session) && profile.isPending,
        error: session ? profile.error : null,
        notice,
        dismissNotice: () => setNotice(null),
        retry: () => {
          void profile.refetch();
        },
        signIn,
        signOut,
        clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
