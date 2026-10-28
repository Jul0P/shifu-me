import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Feedback } from '@/components/ui/feedback';
import { useAuth } from './auth-context';

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return <Feedback title="Un instant…" message="On retrouve ton profil." loading />;
  }

  if (auth.error) {
    return <Feedback title="Profil indisponible" error={auth.error} onRetry={auth.retry} />;
  }

  return auth.user ? children : <Navigate to="/login" replace />;
}
