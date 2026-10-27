import { updateProfileSchema } from '@shifu/shared';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireDatabase } from '../../middleware/database.middleware';
import { UserModel } from './user.model';
import { toPublicUser } from './users.service';

const router = Router();
router.get('/leaderboard', requireDatabase, async (_req, res) => {
  const users = await UserModel.find()
    .sort({
      elo: -1,
      _id: 1,
    })
    .limit(50);
  res.json({
    items: users.map(toPublicUser),
  });
});
router.get('/me', requireAuth, requireDatabase, async (_req, res) => {
  const user = await UserModel.findById(res.locals.userId);
  if (!user) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Utilisateur introuvable',
      },
    });
    return;
  }
  res.json(toPublicUser(user));
});
router.put('/me', requireAuth, requireDatabase, async (req, res) => {
  const body = updateProfileSchema.parse(req.body);
  const update: Record<string, string> = {};
  if (body.username) {
    update.username = body.username;
    update.usernameLower = body.username.toLocaleLowerCase('en-US');
  }
  if (body.avatar) update.avatar = body.avatar;
  try {
    const user = await UserModel.findByIdAndUpdate(
      res.locals.userId,
      {
        $set: update,
      },
      {
        new: true,
        runValidators: true,
      },
    );
    if (!user) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Utilisateur introuvable',
        },
      });
      return;
    }
    res.json(toPublicUser(user));
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
export default router;
