import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
export const Route = createFileRoute('/game/$gameId')({
  component: Game,
});
function Game() {
  const { gameId } = Route.useParams();
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-6 text-4xl font-black">PARTIE {gameId}</h1>
      <Card>À développer : chrono serveur 10 secondes, coups privés, BO5 et polling de la manche.</Card>
    </main>
  );
}
