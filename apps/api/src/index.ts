import 'dotenv/config';
import app from './app';
// Vercel importe l'application Express ; pas de app.listen() en serverless.
export default app;
