import mongoose from 'mongoose';

const sessions: mongoose.ClientSession[] = [];

export function testSession() {
  const client = new mongoose.mongo.MongoClient('mongodb://never-connected.invalid/unused');
  const session = client.startSession();
  sessions.push(session);
  return session;
}

afterEach(async () => {
  for (const session of sessions.splice(0)) {
    await session.endSession();
  }
});
