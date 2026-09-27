// Local MongoDB without Docker: runs the same mongod binary the tests use, on port 27017,
// with data kept in apps/server/.dev-db (git-ignored) so it survives restarts.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = fileURLToPath(new URL('../.dev-db', import.meta.url));
mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({ instance: { port: 27017, dbPath, storageEngine: 'wiredTiger' } });
console.log(`MongoDB ready at ${mongod.getUri()} (data in apps/server/.dev-db). Press Ctrl+C to stop.`);

const stop = async () => {
  await mongod.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
