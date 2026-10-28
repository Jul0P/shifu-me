import type { AuthResponse, PublicUser } from '@shifu/shared';
import { createContext, useContext } from 'react';

type AuthContextValue = {
  user: PublicUser | null;
  token: string | undefined;
  isLoading: boolean;
  error: Error | null;
  notice: string | null;
  dismissNotice: () => void;
  retry: () => void;
  signIn: (response: AuthResponse) => void;
  signOut: () => Promise<void>;
  clearSession: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth requires AuthProvider');
  }

  return context;
}
