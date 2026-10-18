'use strict';

const path = require('node:path');
const { createApp } = require('./src/app');
const { JsonStore } = require('./src/store');

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'applications.json');
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

const app = createApp({ store: new JsonStore(DATA_FILE), allowedOrigins: ALLOWED_ORIGINS });

const server = app.listen(PORT, () => {
  console.log(`HireTrail API listening on http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});

// Error resilience: log unexpected failures instead of dying silently.
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1); // state is unknown: exit and let the host restart us
});

// Graceful shutdown: finish in-flight requests, then exit.
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
