import { AuthSessionModel } from '../modules/auth/auth-session.model';
import { GameModel, MatchModel, RoundModel } from '../modules/game/game.model';
import { LobbyGateModel, ParticipationModel } from '../modules/matchmaking/participation.model';
import { RoomModel } from '../modules/rooms/room.model';
import { UserModel } from '../modules/users/user.model';
import { connectDB } from './database';

const databaseModels = [UserModel, AuthSessionModel, GameModel, RoundModel, MatchModel, ParticipationModel, RoomModel, LobbyGateModel] as const;

// Les premières requêtes attendent la même préparation ; les suivantes réutilisent son succès.
let pending: Promise<void> | undefined;

// Prépare une seule fois les modèles, leurs index et le document de coordination du lobby.
export async function initializeDatabase() {
  await connectDB();
  pending ??= (async () => {
    for (const model of databaseModels) {
      // Attend l'initialisation Mongoose et la création des index, notamment les contraintes uniques.
      await model.init();
    }

    // Crée le verrou logique du lobby sans réinitialiser son compteur s'il existe déjà.
    // Les transactions de matchmaking écrivent ce même document pour ordonner leurs décisions.
    await LobbyGateModel.updateOne(
      {
        _id: 'lobby',
      },
      {
        $setOnInsert: {
          version: 0,
        },
      },
      {
        upsert: true,
      },
    );
  })().catch((error: unknown) => {
    // Autorise une nouvelle tentative de préparation après un échec, sans masquer l'erreur.
    pending = undefined;
    throw error;
  });
  await pending;
}
