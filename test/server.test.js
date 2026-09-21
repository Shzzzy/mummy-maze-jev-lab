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

import { buildSystemOnePayload, parseSystemOneResponse, createJevHandler } from '../server/jev.js';

test('System One 请求包含出口判断和四方向问题', () => {
  const payload = buildSystemOnePayload({
    levelId: 'level-1',
    tiles: [['wall']],
    player: { x: 1, y: 1 },
    monsters: [],
    doorsOpen: false,
    turn: 0,
  });
  assert.equal(payload.model, 'jev-latest');
  assert.equal(payload.questions.toward_exit.type, 'noul');
  assert.deepEqual(Object.keys(payload.questions.next_move.criteria), ['up', 'down', 'left', 'right']);
});

test('解析 System One 的有效方向与概率', () => {
  const result = parseSystemOneResponse({
    answers: {
      toward_exit: { type: 'noul', noul: 0.18 },
      next_move: {
        type: 'choice',
        choice: 'down',
        confidence: 0.91,
        probabilities: { up: 0.04, down: 0.91, left: 0.03, right: 0.02 },
      },
    },
    usage: { input_tokens: 200, output_tokens: 24 },
  });
  assert.equal(result.direction, 'down');
  assert.equal(result.yesProbability, 0.18);
  assert.equal(result.confidence, 0.91);
  assert.equal(result.usage.input_tokens, 200);
});

test('代理不会向客户端泄漏 API Key', async () => {
  const fetcher = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    return new Response(JSON.stringify({
      answers: {
        toward_exit: { type: 'noul', noul: 0.2 },
        next_move: {
          type: 'choice',
          choice: 'left',
          confidence: 0.8,
          probabilities: { up: 0.1, down: 0.1, left: 0.7, right: 0.1 },
        },
      },
      usage: { input_tokens: 10, output_tokens: 5 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const server = createApp({ jevHandler: createJevHandler({ fetcher, apiKey: 'test-key' }) }).listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/jev/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ levelId: 'level-1' }),
    });
    const body = await response.json();
    assert.equal(body.direction, 'left');
    assert.equal(JSON.stringify(body).includes('test-key'), false);
  } finally {
    server.close();
  }
});
