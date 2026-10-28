import { GAME_CONFIG, type Move } from '@shifu/shared';
import { resolveMoves, shouldCancelAfterBothAfk, updatedElo } from '../../src/modules/game/game-engine';

const moves: (Move | null)[] = ['rock', 'paper', 'scissors', null];
const expected = [
  ['TIE', 'PLAYER_2', 'PLAYER_1', 'PLAYER_1'],
  ['PLAYER_1', 'TIE', 'PLAYER_2', 'PLAYER_1'],
  ['PLAYER_2', 'PLAYER_1', 'TIE', 'PLAYER_1'],
  ['PLAYER_2', 'PLAYER_2', 'PLAYER_2', 'BOTH_AFK'],
];

for (const [i, first] of moves.entries()) {
  for (const [j, second] of moves.entries()) {
    test(`résolution des coups (${first}, ${second}) : ${expected[i][j]}`, () => {
      expect(resolveMoves(first, second)).toBe(expected[i][j]);
    });
  }
}

for (const loser of [0, 1, 9, 10, 100]) {
  test(`l'Elo est attribué au match et reste positif ou nul (perdant=${loser})`, () => {
    expect(updatedElo(100, loser)).toEqual({
      winner: 110,
      loser: Math.max(0, loser - 10),
    });
  });
}

test("l'annulation commence exactement à cinq doubles absences consécutives", () => {
  expect(shouldCancelAfterBothAfk(0)).toBe(false);
  expect(shouldCancelAfterBothAfk(4)).toBe(false);
  expect(shouldCancelAfterBothAfk(5)).toBe(true);
  expect(shouldCancelAfterBothAfk(6)).toBe(true);
  expect(GAME_CONFIG.ROUND_DURATION_MS).toBe(10_000);
  expect(GAME_CONFIG.WINS_TO_VICTORY).toBe(3);
  expect(GAME_CONFIG.INITIAL_ELO).toBe(100);
});
