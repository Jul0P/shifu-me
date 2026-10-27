import { resolveMoves, shouldCancelAfterBothAfk, updatedElo } from '../../src/modules/game/game-engine';

describe('moteur BO5 - règles Shifu.me', () => {
  it('Pierre bat Ciseaux', () => expect(resolveMoves('rock', 'scissors')).toBe('PLAYER_1'));
  it('Feuille bat Pierre', () => expect(resolveMoves('rock', 'paper')).toBe('PLAYER_2'));
  it('égalité sans point', () => expect(resolveMoves('paper', 'paper')).toBe('TIE'));
  it('un choix absent : forfait', () => expect(resolveMoves('rock', null)).toBe('PLAYER_1'));
  it('deux absents : double AFK', () => expect(resolveMoves(null, null)).toBe('BOTH_AFK'));
  it('annule après cinq doubles AFK consécutifs', () => {
    expect(shouldCancelAfterBothAfk(4)).toBe(false);
    expect(shouldCancelAfterBothAfk(5)).toBe(true);
  });
  it('Elo +10/-10 avec plancher à zéro', () => {
    expect(updatedElo(100, 4)).toEqual({
      winner: 110,
      loser: 0,
    });
  });
});
