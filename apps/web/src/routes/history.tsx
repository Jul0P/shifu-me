import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
export const Route = createFileRoute('/history')({
  component: History,
});
function History() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-6 text-4xl font-black">HISTORIQUE</h1>
      <Card>À développer : historique des BO5 terminés (hors matchs annulés).</Card>
    </main>
  );
}
