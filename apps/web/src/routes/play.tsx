import { createFileRoute } from '@tanstack/react-router';
import { RequireAuth } from '@/features/auth/require-auth';
import { MatchmakingPage } from '@/features/matchmaking/matchmaking-page';

export const Route = createFileRoute('/play')({ component: Page });

function Page() {
  return (
    <RequireAuth>
      <MatchmakingPage />
    </RequireAuth>
  );
}
