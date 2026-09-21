import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

test('健康检查返回 ok', async () => {
  const server = createApp().listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    server.close();
  }
});
