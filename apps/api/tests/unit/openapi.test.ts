import openapi from '../../src/config/openapi';

test('OpenAPI est sérialisable, ses références existent et ses identifiants sont uniques', () => {
  const document = JSON.parse(JSON.stringify(openapi));
  const ids = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value !== 'object' || value === null) {
      return;
    }
    if ('$ref' in value) {
      expect(typeof value.$ref).toBe('string');
      const reference = String(value.$ref);
      expect(reference.startsWith('#/components/schemas/')).toBeTruthy();
      expect(reference.slice('#/components/schemas/'.length) in openapi.components.schemas).toBeTruthy();
    }
    for (const child of Object.values(value)) {
      visit(child);
    }
  };
  visit(document);
  for (const operations of Object.values(openapi.paths)) {
    for (const operation of Object.values(operations)) {
      if (typeof operation !== 'object' || operation === null || !('operationId' in operation)) {
        throw new Error('Une opération OpenAPI doit posséder un operationId');
      }
      const id = String(operation.operationId);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  }
  expect(ids.size).toBe(22);
  expect(openapi.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
});

test('OpenAPI conserve les champs stricts et les propriétés obligatoires', () => {
  const register = openapi.components.schemas.Register;
  expect(register.additionalProperties).toBe(false);
  expect(register.required).toEqual(['username', 'password']);
  const move = openapi.components.schemas.MoveSubmission;
  expect(move.additionalProperties).toBe(false);
  expect(move.required).toEqual(['roundId', 'move']);
  const profile = openapi.components.schemas.UpdateProfile;
  expect(profile.additionalProperties).toBe(false);
  expect(profile.minProperties).toBe(1);
});

test.each([
  ['get', '/api/health', 'health', false],
  ['get', '/api/ready', 'ready', false],
  ['get', '/api/config', 'config', false],
  ['post', '/api/auth/register', 'register', false],
  ['post', '/api/auth/login', 'login', false],
  ['post', '/api/auth/logout', 'logout', true],
  ['get', '/api/users/me', 'me', true],
  ['put', '/api/users/me', 'updateMe', true],
  ['delete', '/api/users/me', 'deleteMe', true],
  ['get', '/api/users/leaderboard', 'leaderboard', false],
  ['get', '/api/users/me/history', 'history', true],
  ['post', '/api/matchmaking/join', 'queueJoin', true],
  ['get', '/api/matchmaking/status', 'queueStatus', true],
  ['delete', '/api/matchmaking/leave', 'queueLeave', true],
  ['post', '/api/rooms', 'roomCreate', true],
  ['post', '/api/rooms/{code}/join', 'roomJoin', true],
  ['get', '/api/rooms/{code}', 'roomStatus', true],
  ['delete', '/api/rooms/{code}', 'roomDelete', true],
  ['get', '/api/game/{id}/poll', 'gamePoll', true],
  ['post', '/api/game/{id}/action', 'gameAction', true],
  ['post', '/api/game/{id}/resolve', 'gameResolve', true],
  ['get', '/api/game/{id}/rounds', 'gameRounds', true],
] as const)('OpenAPI décrit %s %s avec la bonne authentification', (method, path, operationId, authenticated) => {
  expect(openapi.paths[path]?.[method]).toMatchObject({
    operationId,
    security: authenticated ? [{ bearerAuth: [] }] : [],
    responses: {
      415: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  });
});
