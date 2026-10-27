import type { HealthResponse } from '@shifu/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Swords, Trophy, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
export const Route = createFileRoute('/')({
  component: Home,
});
function Home() {
  const health = useQuery({
    queryKey: [
      'api',
      'health',
    ],
    queryFn: () => apiFetch<HealthResponse>('/api/health'),
  });
  return (
    <main className="mx-auto max-w-6xl px-5 pb-20">
      <section className="grid items-center gap-10 py-12 md:grid-cols-2">
        <div>
          <Badge className="mb-5 bg-white">⚡ MICRO-JEU COMPÉTITIF</Badge>
          <h1 className="text-6xl leading-[.95] font-black tracking-tight md:text-8xl">
            PIERRE.
            <br />
            FEUILLE.
            <br />
            <span
              className="text-white"
              style={{
                WebkitTextStroke: '2px black',
              }}
            >
              CISEAUX.
            </span>
          </h1>
          <p className="mt-7 max-w-lg text-xl font-bold">10 secondes. Deux joueurs. Un seul vainqueur. Prépare-toi pour l'arène.</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button
              asChild
              size="lg"
              className="arcade-button"
            >
              <Link to="/play">
                <Swords size={18} /> JOUER <ArrowRight size={18} />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="arcade-button"
            >
              <Link to="/leaderboard">
                <Trophy size={18} /> TOP JOUEURS
              </Link>
            </Button>
          </div>
          <p
            className="mt-7 text-sm font-semibold"
            aria-live="polite"
          >
            API : {health.isPending ? 'connexion…' : health.isError ? 'indisponible (démarre pnpm dev)' : 'connectée ✓'}
          </p>
        </div>
        <Card className="rotate-1 bg-white p-8 md:p-12">
          <div className="mb-6 text-center text-7xl">✊ ✋ ✌️</div>
          <CardTitle className="text-center text-3xl uppercase">L'ARÈNE T'ATTEND</CardTitle>
          <CardContent className="mt-4 space-y-4 text-base font-bold">
            <div className="flex items-center gap-2">
              <Zap size={18} /> BO5 • Premier à 3 victoires
            </div>
            <div className="flex items-center gap-2">
              <Zap size={18} /> Chrono serveur de 10 s
            </div>
            <div className="flex items-center gap-2">
              <Zap size={18} /> Elo : 100 au départ, ±10 par match
            </div>
          </CardContent>
        </Card>
      </section>
      <p className="text-sm font-semibold">Starter technique : matchmaking et jeu en ligne à implémenter dans les prochains sprints.</p>
    </main>
  );
}
