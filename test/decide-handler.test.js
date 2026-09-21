import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createDecisionHandler, createJevScorer } from '../server/decide-handler.js';
import { createDeepSeekAnalyzer } from '../server/analysis.js';

const facts = {
  player: { x: 1, y: 1 },
  monsters: [],
  exit: { x: 2, y: 1 },
  doorsOpen: false,
  adjacentTiles: {
    up: 'wall',
    down: 'wall',
    left: 'wall',
    right: 'floor',
  },
};

function snapshot() {
  return {
    levelId: 'level-1',
    player: { x: 1, y: 1 },
    doorsOpen: false,
    tiles: [
      ['wall', 'wall', 'wall'],
      ['wall', 'floor', 'floor'],
      ['wall', 'wall', 'wall'],
    ],
  };
}

function scoreResult(direction = 'right') {
  const make = (item, score, confidence) => ({
    direction: item,
    score,
    normalizedScore: score / 5,
    confidence,
    probabilities: {},
    legend: {},
  });
  return {
    model: 'jev-1.13.0',
    scores: {
      right: make('right', direction === 'right' ? 5 : 1, 0.9),
    },
    usage: { input_tokens: 30, output_tokens: 6 },
  };
}

test('决策接口选择最高分动作并返回完整上下文', async () => {
  const server = createApp({
    decisionHandler: createDecisionHandler({
      analyze: async () => ({
        facts,
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
      score: async (payload, legalDirections) => {
        assert.equal(payload.state.facts, facts);
        assert.deepEqual(legalDirections, ['right']);
        return scoreResult('right');
      },
    }),
  }).listen(0);

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot()),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.direction, 'right');
    assert.equal(body.score, 5);
    assert.equal(body.confidence, 0.9);
    assert.equal(body.analysisUsage.prompt_tokens, 10);
    assert.equal(body.scoringUsage.input_tokens, 30);
    assert.equal(body.facts.player.x, 1);
  } finally {
    server.close();
  }
});

test('缺少 DeepSeek Key 时返回 503', async () => {
  const server = createApp({
    decisionHandler: createDecisionHandler({
      analyze: createDeepSeekAnalyzer({ apiKey: '' }),
      score: async () => scoreResult(),
    }),
  }).listen(0);

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot()),
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error, 'DEEPSEEK_NOT_CONFIGURED');
  } finally {
    server.close();
  }
});

test('DeepSeek 上游错误透传状态和错误码', async () => {
  const error = new Error('余额不足，请先充值');
  error.code = 'DEEPSEEK_BALANCE_REQUIRED';
  error.status = 402;
  const server = createApp({
    decisionHandler: createDecisionHandler({
      analyze: async () => { throw error; },
      score: async () => scoreResult(),
    }),
  }).listen(0);

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot()),
    });
    const body = await response.json();
    assert.equal(response.status, 402);
    assert.equal(body.error, 'DEEPSEEK_BALANCE_REQUIRED');
  } finally {
    server.close();
  }
});

test('DeepSeek 超时映射为 504', async () => {
  const timeout = new Error('timeout');
  timeout.name = 'TimeoutError';
  const server = createApp({
    decisionHandler: createDecisionHandler({
      analyze: async () => { throw timeout; },
      score: async () => scoreResult(),
    }),
  }).listen(0);

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot()),
    });
    const body = await response.json();
    assert.equal(response.status, 504);
    assert.equal(body.error, 'DEEPSEEK_TIMEOUT');
  } finally {
    server.close();
  }
});

test('Jev 评分错误返回明确错误', async () => {
  const error = new Error('Jev 缺少评分');
  error.code = 'JEV_INVALID_SCORE';
  error.status = 502;
  const server = createApp({
    decisionHandler: createDecisionHandler({
      analyze: async () => ({ facts, usage: {} }),
      score: async () => { throw error; },
    }),
  }).listen(0);

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot()),
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error, 'JEV_INVALID_SCORE');
  } finally {
    server.close();
  }
});

test('没有合法动作时不调用 Jev 并返回 422', async () => {
  let scoreCalled = false;
  const server = createApp({
    decisionHandler: createDecisionHandler({
      analyze: async () => ({ facts, usage: {} }),
      score: async () => {
        scoreCalled = true;
        return scoreResult();
      },
    }),
  }).listen(0);

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/decide`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        player: { x: 1, y: 1 },
        doorsOpen: false,
        tiles: [
          ['wall', 'wall', 'wall'],
          ['wall', 'floor', 'wall'],
          ['wall', 'wall', 'wall'],
        ],
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.error, 'NO_LEGAL_ACTION');
    assert.equal(scoreCalled, false);
  } finally {
    server.close();
  }
});

test('Jev 读取响应超时映射为 JEV_TIMEOUT', async () => {
  const scorer = createJevScorer({
    apiKey: 'test-key',
    fetcher: async () => ({
      ok: true,
      status: 200,
      text: async () => {
        const error = new Error('timeout');
        error.name = 'TimeoutError';
        throw error;
      },
    }),
  });

  await assert.rejects(
    () => scorer({ questions: {} }, ['right']),
    (error) => error.code === 'JEV_TIMEOUT' && error.status === 504,
  );
});

test('Jev scorer 发送 score 请求并解析响应', async () => {
  const calls = [];
  const scorer = createJevScorer({
    apiKey: 'test-key',
    baseUrl: 'https://example.test',
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        model: 'jev-1.13.0',
        answers: {
          right_score: {
            type: 'score',
            score: 4,
            confidence: 0.8,
            probabilities: { 4: 0.8, 5: 0.2 },
            legend: { 4: '好', 5: '最好' },
          },
        },
        usage: { input_tokens: 8, output_tokens: 2 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const result = await scorer({ questions: {} }, ['right']);
  assert.equal(result.scores.right.score, 4);
  assert.equal(result.usage.input_tokens, 8);
  assert.equal(calls[0].url, 'https://example.test/v1/systemone');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
});
