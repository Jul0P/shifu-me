import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
export const Route = createFileRoute('/play')({
  component: Play,
});
function Play() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-6 text-4xl font-black">⚔️ MATCHMAKING</h1>
      <Card>
        <p className="text-lg font-bold">À développer : file d'attente HTTP, recherche d'adversaire et polling toutes les secondes.</p>
        <p className="mt-3 text-sm">Aucune recherche fictive n'est lancée depuis cette page.</p>
      </Card>
    </main>
  );
}
