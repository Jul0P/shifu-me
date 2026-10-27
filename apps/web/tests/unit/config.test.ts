import { GAME_CONFIG, moveSchema } from '@shifu/shared';

test('Shifu.me démarre avec 100 Elo et un chrono de 10s', () => {
  expect(GAME_CONFIG.INITIAL_ELO).toBe(100);
  expect(GAME_CONFIG.ROUND_DURATION_MS).toBe(10_000);
  expect(moveSchema.safeParse('lizard').success).toBe(false);
});
