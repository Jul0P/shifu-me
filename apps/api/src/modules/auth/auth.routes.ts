import { GAME_CONFIG, loginSchema, registerSchema } from '@shifu/shared';
import bcrypt from 'bcrypt';
import { Router } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { UserModel } from '../users/user.model';
import { toPublicUser } from '../users/users.service';

const router = Router();
function tokenFor(id: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET manquant');
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];
  return jwt.sign({}, secret, {
    subject: id,
    expiresIn,
    algorithm: 'HS256',
  });
}

router.post('/register', async (req, res) => {
  const { username, password } = registerSchema.parse(req.body);
  await requireDatabasePromise();
  const usernameLower = username.toLocaleLowerCase('en-US');
  if (
    await UserModel.exists({
      usernameLower,
    })
  ) {
    res.status(409).json({
      error: {
        code: 'USERNAME_ALREADY_USED',
        message: 'Pseudo indisponible',
      },
    });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await UserModel.create({
      username,
      usernameLower,
      passwordHash,
      elo: GAME_CONFIG.INITIAL_ELO,
    });
    res.status(201).json({
      user: toPublicUser(user),
      token: tokenFor(String(user._id)),
    });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      res.status(409).json({
        error: {
          code: 'USERNAME_ALREADY_USED',
          message: 'Pseudo indisponible',
        },
      });
      return;
    }
    throw error;
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  await requireDatabasePromise();
  const user = await UserModel.findOne({
    usernameLower: username.toLocaleLowerCase('en-US'),
  }).select('+passwordHash');
  const accepted = user ? await bcrypt.compare(password, String(user.get('passwordHash'))) : false;
  if (!user || !accepted) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Identifiants invalides',
      },
    });
    return;
  }
  res.status(200).json({
    user: toPublicUser(user),
    token: tokenFor(String(user._id)),
  });
});

async function requireDatabasePromise() {
  const { connectDB } = await import('../../config/database');
  await connectDB();
}
export default router;
