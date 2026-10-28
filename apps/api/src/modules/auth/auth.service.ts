import { randomUUID } from 'node:crypto';
import { type AuthResponse, GAME_CONFIG, type loginSchema, type registerSchema } from '@shifu/shared';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { ClientSession } from 'mongoose';
import type { z } from 'zod';
import { transaction } from '../../config/database';
import { ApiError } from '../../lib/api-error';
import { type UserDocument, UserModel } from '../users/user.model';
import { toPublicUser } from '../users/users.service';
import { AuthSessionModel } from './auth-session.model';

type Credentials = {
  token: string;
  sessionId: string;
  expiresAt: Date;
};

export class AuthService {
  // Charge le secret JWT et refuse les valeurs absentes, trop courtes ou laissées en exemple.
  private secret() {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32 || secret.startsWith('REPLACE_') || secret.startsWith('REMPLACER_')) {
      throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Configurer un JWT_SECRET aléatoire de 32 caractères minimum');
    }

    return secret;
  }

  // Génère un identifiant de session, signe le JWT et récupère sa date d'expiration.
  private credentials(userId: string): Credentials {
    const secret = this.secret();
    const sessionId = randomUUID();

    try {
      // sub identifie le compte, jti la session révocable ; iss/aud réservent le jeton à cette API/client.
      const token = jwt.sign({}, secret, {
        subject: userId,
        jwtid: sessionId,
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'],
        algorithm: 'HS256',
        issuer: 'shifu-api',
        audience: 'shifu-web',
      });
      // Ici, le jeton vient d'être signé par nous : decode sert seulement à récupérer son expiration.
      // Un jeton reçu du client doit passer par verify(), pas par decode().
      const payload = jwt.decode(token);

      if (!payload || typeof payload === 'string' || typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
        throw new Error('Invalid expiration');
      }

      return {
        token,
        sessionId,
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Configurer une durée JWT_EXPIRES_IN valide, par exemple 7d');
    }
  }

  // Enregistre la session révocable et construit la réponse d'authentification publique.
  private async issue(user: UserDocument, credentials: Credentials, session?: ClientSession): Promise<AuthResponse> {
    // Le JWT reste utilisable uniquement tant que cette session existe et n'a pas expiré.
    await AuthSessionModel.create(
      [
        {
          _id: credentials.sessionId,
          userId: String(user._id),
          expiresAt: credentials.expiresAt,
        },
      ],
      {
        session,
      },
    );

    return {
      user: toPublicUser(user),
      token: credentials.token,
      expiresAt: credentials.expiresAt.toISOString(),
    };
  }

  // Hache le mot de passe puis crée ensemble le compte à l'Elo initial et sa première session.
  async register(input: z.infer<typeof registerSchema>) {
    const user = new UserModel({
      username: input.username,
      usernameLower: input.username.toLowerCase(),
      avatar: input.avatar ?? '🪨',
      elo: GAME_CONFIG.INITIAL_ELO,
    });
    // Refuse une configuration JWT invalide avant toute écriture ; bcrypt reste hors transaction.
    const credentials = this.credentials(String(user._id));
    user.passwordHash = await bcrypt.hash(input.password, 12);

    // Compte et session initiale sont créés ensemble : pas de compte partiel si la session échoue.
    return transaction(async (session) => {
      await user.save({
        session,
      });

      return this.issue(user, credentials, session);
    });
  }

  // Vérifie les identifiants avec bcrypt puis ouvre une nouvelle session de connexion.
  async login(input: z.infer<typeof loginSchema>) {
    const user = await UserModel.findOne({
      usernameLower: input.username.toLowerCase(),
    }).select('+passwordHash');
    // Le hash est masqué par défaut dans le modèle ; la connexion en a besoin pour bcrypt.compare.
    // Conserve un calcul bcrypt même pour un pseudo absent, afin de réduire les écarts de temps.
    const fallback = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxjOGBnMq8tG7VOJR6xLKzVfvHy';
    const accepted = await bcrypt.compare(input.password, user?.passwordHash ?? fallback);

    if (!user || !accepted) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Identifiants invalides');
    }

    return this.issue(user, this.credentials(String(user._id)));
  }

  // Vérifie la signature et les claims du JWT, puis extrait les identifiants du compte et de la session.
  verify(token: string) {
    const payload = jwt.verify(token, this.secret(), {
      algorithms: ['HS256'],
      issuer: 'shifu-api',
      audience: 'shifu-web',
    });

    if (typeof payload === 'string' || typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub) || typeof payload.jti !== 'string' || !payload.exp) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Jeton invalide');
    }

    return {
      userId: payload.sub,
      sessionId: payload.jti,
    };
  }

  // Refuse une session absente ou expirée, ainsi qu'un compte supprimé.
  async active(userId: string, sessionId: string) {
    // Le nettoyage TTL n'est pas immédiat : vérifier la date même si le document existe encore.
    const active = await AuthSessionModel.exists({
      _id: sessionId,
      userId,
      expiresAt: {
        $gt: new Date(),
      },
    });

    if (
      !active ||
      !(await UserModel.exists({
        _id: userId,
      }))
    ) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Session expirée ou révoquée');
    }
  }

  // Supprime uniquement la session de connexion désignée pour ce compte.
  async logout(userId: string, sessionId: string) {
    // Supprimer ce jti révoque la session courante sans fermer les autres sessions du compte.
    await AuthSessionModel.deleteOne({
      _id: sessionId,
      userId,
    });
  }
}
