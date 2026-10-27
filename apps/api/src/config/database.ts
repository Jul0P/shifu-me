import mongoose from 'mongoose';

let connectionPromise: ReturnType<typeof mongoose.connect> | null = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connectionPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI manquant');
    connectionPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 5000,
      })
      .catch((error: unknown) => {
        connectionPromise = null;
        throw error;
      });
  }
  return connectionPromise;
}
