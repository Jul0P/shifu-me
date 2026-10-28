import { GAME_CONFIG, type LobbyResponse, lobbyResponseSchema } from '@shifu/shared';
import { apiRequest } from '@/lib/api-client';

export function lobbyRequest(path: string, token: string | undefined, method = 'GET', signal?: AbortSignal) {
  return apiRequest(path, lobbyResponseSchema, { method, token, signal });
}

export function lobbyPollInterval(state: LobbyResponse | undefined, failures = 0): number | false {
  if (state?.status === 'matched') {
    return false;
  }

  return Math.min(GAME_CONFIG.MATCHMAKING_POLL_MS * 2 ** failures, 10_000);
}
