import mongoose from 'mongoose';
import { ApiError } from '../lib/api-error';

// Mutualise la connexion en cours sur une instance chaude, sans stocker d'état métier.
let connectionPromise: ReturnType<typeof mongoose.connect> | null = null;

// Ouvre ou réutilise la connexion MongoDB et signale son indisponibilité.
export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectionPromise || mongoose.connection.readyState === 0) {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'MONGODB_URI manquant');
    }
    connectionPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 5000,
      })
      .catch(() => {
        // Une tentative ratée ne doit pas bloquer définitivement les requêtes suivantes.
        connectionPromise = null;
        throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Connexion MongoDB indisponible');
      });
  }

  return connectionPromise;
}

// Vérifie que le serveur MongoDB connecté prend en charge les transactions multi-documents.
export async function requireTransactions() {
  // Les transactions multi-documents exigent un replica set ou un cluster shardé (isdbgrid).
  await connectDB();
  const hello = await mongoose.connection.db?.admin().command({
    hello: 1,
  });

  if (!hello?.setName && hello?.msg !== 'isdbgrid') {
    throw new ApiError(503, 'REPLICA_SET_REQUIRED', 'Le jeu nécessite un replica set MongoDB. Voir README.md, section MongoDB local.');
  }
}

// Exécute les opérations du callback dans une transaction MongoDB tout-ou-rien.
export async function transaction<T>(work: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  // Tout est validé au commit ou annulé en cas d'échec : score, Elo et historique restent liés.
  // Chaque opération du callback doit recevoir cette session et rester séquentielle (pas de Promise.all).
  // Le pilote peut rejouer le callback sur conflit : ne pas y envoyer d'e-mail ni d'autre effet externe.
  await requireTransactions();

  return mongoose.connection.transaction(work, {
    readConcern: {
      // Lit un instantané cohérent des documents pendant la transaction.
      level: 'snapshot',
    },
    writeConcern: {
      // Attend l'acquittement d'une majorité des membres du replica set.
      w: 'majority',
    },
    // Utilise le primaire pour les lectures de cette transaction en écriture.
    readPreference: 'primary',
    // Borne le commit, pas la durée totale du callback ni de ses éventuelles nouvelles tentatives.
    maxCommitTimeMS: 5000,
  });
}
