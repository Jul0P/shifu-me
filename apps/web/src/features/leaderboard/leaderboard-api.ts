import { leaderboardResponseSchema } from '@shifu/shared';
import { apiRequest } from '@/lib/api-client';

export function leaderboardOptions(page = 1, limit = 20) {
  return {
    queryKey: ['leaderboard', page, limit],
    queryFn: ({ signal }: { signal: AbortSignal }) => apiRequest(`/api/users/leaderboard?page=${page}&limit=${limit}`, leaderboardResponseSchema, { signal }),
  };
}
