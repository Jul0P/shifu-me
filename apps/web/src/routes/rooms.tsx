import { createFileRoute } from '@tanstack/react-router';
import { RequireAuth } from '@/features/auth/require-auth';
import { RoomsPage } from '@/features/rooms/rooms-page';

export const Route = createFileRoute('/rooms')({ component: Page });

function Page() {
  return (
    <RequireAuth>
      <RoomsPage />
    </RequireAuth>
  );
}
