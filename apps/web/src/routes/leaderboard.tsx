import type { PublicUser } from '@shifu/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
export const Route = createFileRoute('/leaderboard')({
  component: Leaderboard,
});
function Leaderboard() {
  const query = useQuery({
    queryKey: [
      'leaderboard',
    ],
    queryFn: () =>
      apiFetch<{
        items: PublicUser[];
      }>('/api/users/leaderboard'),
  });
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-7 text-4xl font-black">🏆 CLASSEMENT</h1>
      <Card>
        {query.isPending ? (
          <p>Chargement…</p>
        ) : query.isError ? (
          <p>Impossible de charger le classement. Configure MongoDB.</p>
        ) : query.data.items.length === 0 ? (
          <p>Aucun joueur pour le moment.</p>
        ) : (
          <ol className="divide-y-2 divide-black">
            {query.data.items.map((u, i) => (
              <li
                key={u.id}
                className="flex justify-between gap-3 py-3"
              >
                <span>
                  {i + 1}. {u.avatar} {u.username}
                </span>
                <strong>{u.elo} Elo</strong>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </main>
  );
}
