// Point d'entrée local : charger l'environnement avant de construire l'application et ouvrir le port.
import 'dotenv/config';
import app from './app';

const port = Number(process.env.PORT ?? 3000);
// Affiche l'adresse locale lorsque le serveur a commencé à écouter.
app.listen(port, () => {
  console.log(`Shifu.me API disponible sur http://localhost:${port}`);
});
