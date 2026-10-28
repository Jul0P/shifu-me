import { createFileRoute } from '@tanstack/react-router';
import { LeaderboardPage } from '@/features/leaderboard/leaderboard-page';

export const Route = createFileRoute('/leaderboard')({ component: LeaderboardPage });
