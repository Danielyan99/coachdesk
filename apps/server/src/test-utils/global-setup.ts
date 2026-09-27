import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Starts one in-memory MongoDB for the whole test run (the first run downloads the binary,
 * which can take longer than a test timeout). Each test file gets its own database on it.
 */
export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  (globalThis as { __MONGOD__?: MongoMemoryServer }).__MONGOD__ = mongod;
  process.env.MONGO_TEST_URI = mongod.getUri();
}
