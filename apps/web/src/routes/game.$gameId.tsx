import { objectIdSchema } from '@shifu/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Feedback } from '@/components/ui/feedback';
import { RequireAuth } from '@/features/auth/require-auth';
import { GamePage } from '@/features/game/game-page';

export const Route = createFileRoute('/game/$gameId')({ component: Page });

function Page() {
  const { gameId } = Route.useParams();

  return <RequireAuth>{objectIdSchema.safeParse(gameId).success ? <GamePage key={gameId} gameId={gameId} /> : <Feedback title="Partie introuvable" message="Ce lien de partie est invalide." />}</RequireAuth>;
}
