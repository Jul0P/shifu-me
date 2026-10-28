import { createFileRoute } from '@tanstack/react-router';
import { RequireAuth } from '@/features/auth/require-auth';
import { HistoryPage } from '@/features/profile/history-page';

export const Route = createFileRoute('/history')({ component: Page });

function Page() {
  return (
    <RequireAuth>
      <HistoryPage />
    </RequireAuth>
  );
}
