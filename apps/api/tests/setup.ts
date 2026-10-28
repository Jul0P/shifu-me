import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

beforeEach(() => {
  jest.replaceProperty(process, 'env', {
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: randomBytes(32).toString('hex'),
    JWT_EXPIRES_IN: '1h',
    FRONTEND_URL: 'http://localhost:5173',
  });
  delete process.env.MONGODB_URI;

  const refuseConnection = () => {
    throw new Error('Les tests ne doivent jamais ouvrir de connexion MongoDB');
  };
  jest.spyOn(mongoose, 'connect').mockImplementation(refuseConnection);
  jest.spyOn(mongoose, 'createConnection').mockImplementation(refuseConnection);
  jest.spyOn(mongoose.mongo.MongoClient.prototype, 'connect').mockImplementation(refuseConnection);
});
