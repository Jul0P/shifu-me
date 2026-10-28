import { loginSchema, paginationSchema, passwordSchema, registerSchema, roomCodeSchema, submitMoveSchema, updateProfileSchema, usernameSchema } from '@shifu/shared';

test("l'inscription nettoie le pseudo et refuse les champs inconnus ou réservés au serveur", () => {
  const input = {
    username: '  Ninja_42  ',
    password: 'ShifuCompte1!',
  };
  expect(registerSchema.parse(input).username).toBe('Ninja_42');
  for (const field of ['elo', 'stats', 'userId', 'passwordHash']) {
    expect(
      registerSchema.safeParse({
        ...input,
        [field]: 999,
      }).success,
    ).toBe(false);
  }
});

for (const username of ['ab', 'x'.repeat(25), 'with spaces', 'with.dot', '']) {
  test(`le pseudo invalide est refusé : ${JSON.stringify(username)}`, () => {
    expect(usernameSchema.safeParse(username).success).toBe(false);
  });
}

test('le mot de passe respecte la complexité et la limite en octets UTF-8, y compris à la connexion', () => {
  expect(passwordSchema.safeParse('a'.repeat(7)).success).toBe(false);
  expect(passwordSchema.safeParse('ShifuCompte1!').success).toBe(true);
  expect(passwordSchema.safeParse('Aa1!abcdefgh').success).toBe(true);
  expect(passwordSchema.safeParse('Aa1!abcdefg').success).toBe(false);
  expect(passwordSchema.safeParse(`Aa1!${'a'.repeat(68)}`).success).toBe(true);
  expect(passwordSchema.safeParse(`Aa1!${'a'.repeat(69)}`).success).toBe(false);
  expect(passwordSchema.safeParse(`Aa1!${'\u00e9'.repeat(34)}`).success).toBe(true);
  expect(passwordSchema.safeParse(`Aa1!${'\u00e9'.repeat(35)}`).success).toBe(false);
  for (const password of ['Court1!', 'shifucompte1!', 'SHIFUCOMPTE1!', 'ShifuCompte!!', 'ShifuCompte12', 'ShifuCompte12 ']) {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  }
  expect(loginSchema.safeParse({ username: 'Ninja', password: 'legacy-password' }).success).toBe(true);
  expect(
    loginSchema.safeParse({
      username: 'Ninja',
      password: '\u00e9'.repeat(37),
    }).success,
  ).toBe(false);
});

test('le profil exige au moins un champ modifiable et un avatar autorisé', () => {
  expect(updateProfileSchema.safeParse({}).success).toBe(false);
  expect(
    updateProfileSchema.safeParse({
      elo: 200,
    }).success,
  ).toBe(false);
  expect(
    updateProfileSchema.safeParse({
      avatar: 'invalid',
    }).success,
  ).toBe(false);
  expect(
    updateProfileSchema.safeParse({
      username: 'Ninja',
    }).success,
  ).toBe(true);
});

test("un coup exige l'identifiant de manche et un signe autorisé, sans identité dans le corps", () => {
  const roundId = 'ABCDEF0123456789ABCDEF01';
  expect(
    submitMoveSchema.parse({
      roundId,
      move: 'rock',
    }),
  ).toEqual({
    roundId: roundId.toLowerCase(),
    move: 'rock',
  });
  for (const body of [
    {
      move: 'rock',
    },
    {
      roundId: 'invalid',
      move: 'rock',
    },
    {
      roundId,
      move: 'lizard',
    },
    {
      roundId,
      move: 'rock',
      playerId: roundId,
    },
  ]) {
    expect(submitMoveSchema.safeParse(body).success).toBe(false);
  }
});

test('la pagination convertit les paramètres et respecte les valeurs par défaut et les limites', () => {
  expect(paginationSchema.parse({})).toEqual({
    page: 1,
    limit: 20,
  });
  expect(
    paginationSchema.parse({
      page: '2',
      limit: '50',
    }),
  ).toEqual({
    page: 2,
    limit: 50,
  });
  for (const query of [
    {
      page: 0,
    },
    {
      page: 1.5,
    },
    {
      page: 100_001,
    },
    {
      page: 'NaN',
    },
    {
      limit: 0,
    },
    {
      limit: 51,
    },
    {
      extra: 'unexpected',
    },
  ]) {
    expect(paginationSchema.safeParse(query).success).toBe(false);
  }
});

test('les codes de salle sont normalisés et excluent les caractères ambigus', () => {
  expect(roomCodeSchema.parse(' ab23 ')).toBe('AB23');
  for (const code of ['ABC', 'ABCDE', 'AB01', 'ABIO', '<AB>']) {
    expect(roomCodeSchema.safeParse(code).success).toBe(false);
  }
});
