import { randomBytes } from 'node:crypto';
import { authResponseSchema } from '@shifu/shared';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { transaction } from '../../src/config/database';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AuthSessionModel } from '../../src/modules/auth/auth-session.model';
import { type UserDocument, UserModel } from '../../src/modules/users/user.model';
import { testSession } from '../helpers/database';

jest.mock('../../src/config/database', () => ({ transaction: jest.fn() }));

const options: SignOptions = {
  subject: 'abcdef0123456789abcdef01',
  jwtid: 'session-id',
  issuer: 'shifu-api',
  audience: 'shifu-web',
  expiresIn: '1h',
  algorithm: 'HS256',
};

test('un JWT valide restitue uniquement les identifiants du compte et de la session', () => {
  const token = jwt.sign({}, process.env.JWT_SECRET ?? '', options);
  expect(new AuthService().verify(token)).toEqual({ userId: options.subject, sessionId: options.jwtid });
});

test.each<[string, SignOptions]>([
  ['expiration dépassée', { expiresIn: -1 }],
  ['émetteur incorrect', { issuer: 'another-api' }],
  ['destinataire incorrect', { audience: 'another-client' }],
  ['identifiant utilisateur invalide', { subject: 'not-an-object-id' }],
  ['session absente', { jwtid: undefined }],
  ['expiration absente', { expiresIn: undefined }],
  ['algorithme non autorisé', { algorithm: 'HS384' }],
])('le JWT est refusé : %s', (_label, overrides) => {
  const signingOptions = { ...options, ...overrides };
  if (signingOptions.jwtid === undefined) {
    delete signingOptions.jwtid;
  }
  if (signingOptions.expiresIn === undefined) {
    delete signingOptions.expiresIn;
  }
  const token = jwt.sign({}, process.env.JWT_SECRET ?? '', signingOptions);
  expect(() => new AuthService().verify(token)).toThrow();
});

test('les JWT malformés ou signés avec une autre clé sont refusés', () => {
  const service = new AuthService();
  expect(() => service.verify('not-a-jwt')).toThrow();
  expect(() => service.verify(jwt.sign({}, randomBytes(32).toString('hex'), options))).toThrow();
});

test.each(['', 'short', 'REPLACE_WITH_RANDOM_HEX_AT_LEAST_32_BYTES'])("une configuration JWT invalide bloque l'inscription avant toute écriture : %s", async (secret) => {
  process.env.JWT_SECRET = secret;
  const save = jest.spyOn(UserModel.prototype, 'save');
  await expect(new AuthService().register({ username: 'Ninja', password: 'ShifuCompte1!' })).rejects.toMatchObject({ status: 503, code: 'AUTH_UNAVAILABLE' });
  expect(save).not.toHaveBeenCalled();
});

test("l'inscription hache le mot de passe, initialise l'Elo à 100 et lie compte et session à la même transaction", async () => {
  const session = testSession();
  jest.mocked(transaction).mockImplementation(async (work) => work(session));
  const save = jest.spyOn(UserModel.prototype, 'save').mockImplementation(async function (this: UserDocument) {
    return this;
  });
  const sessions = jest.spyOn(AuthSessionModel, 'create').mockResolvedValue([]);
  const result = authResponseSchema.parse(await new AuthService().register({ username: 'Ninja', password: 'ShifuCompte1!' }));
  const user = save.mock.contexts[0];
  expect(user.usernameLower).toBe('ninja');
  expect(user.passwordHash).not.toBe('ShifuCompte1!');
  expect(await bcrypt.compare('ShifuCompte1!', user.passwordHash)).toBe(true);
  expect(save).toHaveBeenCalledWith({ session });
  expect(sessions).toHaveBeenCalledWith([expect.objectContaining({ userId: result.user.id })], { session });
  expect(result.user.elo).toBe(100);
  expect(result.user).not.toHaveProperty('passwordHash');
});

test("un échec d'enregistrement de session est propagé à la transaction d'inscription", async () => {
  const session = testSession();
  jest.mocked(transaction).mockImplementation(async (work) => work(session));
  jest.spyOn(UserModel.prototype, 'save').mockImplementation(async function (this: UserDocument) {
    return this;
  });
  const error = new Error('Session non enregistrée');
  jest.spyOn(AuthSessionModel, 'create').mockRejectedValue(error);
  await expect(new AuthService().register({ username: 'Ninja', password: 'ShifuCompte1!' })).rejects.toBe(error);
});

test('la connexion vérifie bcrypt et émet une session révocable sans exposer le hash', async () => {
  const user = new UserModel({ username: 'Ninja', usernameLower: 'ninja', passwordHash: await bcrypt.hash('valid-password', 4) });
  const query = UserModel.findOne();
  jest.spyOn(query, 'exec').mockResolvedValue(user);
  const lookup = jest.spyOn(UserModel, 'findOne').mockReturnValue(query);
  const sessions = jest.spyOn(AuthSessionModel, 'create').mockResolvedValue([]);
  const service = new AuthService();
  await expect(service.login({ username: 'NINJA', password: 'wrong-password' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(sessions).not.toHaveBeenCalled();
  const result = authResponseSchema.parse(await service.login({ username: 'NINJA', password: 'valid-password' }));
  expect(result.user.id).toBe(String(user._id));
  expect(result.user.elo).toBe(100);
  expect(result.user).not.toHaveProperty('passwordHash');
  expect(lookup).toHaveBeenCalledWith({ usernameLower: 'ninja' });
  const identity = service.verify(result.token);
  expect(identity.userId).toBe(result.user.id);
  expect(sessions).toHaveBeenCalledTimes(1);
  expect(sessions).toHaveBeenCalledWith([{ _id: identity.sessionId, userId: result.user.id, expiresAt: new Date(result.expiresAt) }], { session: undefined });
});

test("un pseudo inconnu n'entraîne pas la création de session", async () => {
  const query = UserModel.findOne();
  jest.spyOn(query, 'exec').mockResolvedValue(null);
  jest.spyOn(UserModel, 'findOne').mockReturnValue(query);
  const sessions = jest.spyOn(AuthSessionModel, 'create').mockResolvedValue([]);
  await expect(new AuthService().login({ username: 'Unknown', password: 'valid-password' })).rejects.toMatchObject({ status: 401 });
  expect(sessions).not.toHaveBeenCalled();
});

test('une session révoquée ou un compte supprimé ne peuvent plus authentifier le joueur', async () => {
  const objectId = new mongoose.Types.ObjectId();
  const id = String(objectId);
  const sessionQuery = AuthSessionModel.exists({});
  const sessionExists = jest.spyOn(sessionQuery, 'exec').mockResolvedValue(null);
  jest.spyOn(AuthSessionModel, 'exists').mockReturnValue(sessionQuery);
  const userQuery = UserModel.exists({});
  const userExists = jest.spyOn(userQuery, 'exec').mockResolvedValue({ _id: objectId });
  jest.spyOn(UserModel, 'exists').mockReturnValue(userQuery);
  const service = new AuthService();
  await expect(service.active(id, 'revoked-session')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(userExists).not.toHaveBeenCalled();
  sessionExists.mockResolvedValue({ _id: 'active-session' });
  userExists.mockResolvedValue(null);
  await expect(service.active(id, 'active-session')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  userExists.mockResolvedValue({ _id: objectId });
  await expect(service.active(id, 'active-session')).resolves.toBeUndefined();
});

test('la déconnexion révoque uniquement la session du joueur authentifié', async () => {
  const remove = jest.spyOn(AuthSessionModel, 'deleteOne').mockResolvedValue({ acknowledged: true, deletedCount: 1 });
  await new AuthService().logout('user-id', 'session-id');
  expect(remove).toHaveBeenCalledWith({ _id: 'session-id', userId: 'user-id' });
});
