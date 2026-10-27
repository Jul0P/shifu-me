import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
export const Route = createFileRoute('/profile')({
  component: Profile,
});
function Profile() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-6 text-4xl font-black">PROFIL</h1>
      <Card>À développer : persistance de la session JWT, mise à jour du pseudo et de l'avatar.</Card>
    </main>
  );
}
