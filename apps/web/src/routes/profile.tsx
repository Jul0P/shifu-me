import { createFileRoute } from '@tanstack/react-router';
import { PageHeading } from '@/components/ui/page-heading';
import { useAuth } from '@/features/auth/auth-context';
import { RequireAuth } from '@/features/auth/require-auth';
import { DeleteAccount } from '@/features/profile/delete-account';
import { ProfileForm } from '@/features/profile/profile-form';

export const Route = createFileRoute('/profile')({ component: Page });

function Page() {
  const { user } = useAuth();

  return (
    <RequireAuth>
      <section className="space-y-5">
        <PageHeading>✏️ MON PROFIL</PageHeading>
        <div className="arcade-card bg-white p-5">{user && <ProfileForm key={user.id} user={user} />}</div>
        <DeleteAccount />
      </section>
    </RequireAuth>
  );
}
