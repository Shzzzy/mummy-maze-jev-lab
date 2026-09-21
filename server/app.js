import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp({ jevHandler, decisionHandler } = {}) {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health', (_request, response) => response.json({ ok: true }));
  if (jevHandler) {
    app.post('/api/jev/decide', jevHandler);
  }
  if (decisionHandler) {
    app.post('/api/decide', decisionHandler);
  }
  app.use(express.static(path.join(rootDir, 'public')));
  app.use('/src', express.static(path.join(rootDir, 'src')));
  return app;
}
