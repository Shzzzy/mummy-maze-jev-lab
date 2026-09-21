import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeepSeekMessages,
  createDeepSeekAnalyzer,
  parseDeepSeekFacts,
  validateFactsAgainstSnapshot,
} from '../server/analysis.js';

const matchingSnapshot = {
  player: { x: 1, y: 2 },
  monsters: [{ id: 'white-1', type: 'white', x: 3, y: 2 }],
  doorsOpen: false,
  tiles: [
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
    ['wall', 'floor', 'floor', 'floor', 'floor', 'wall'],
    ['floor', 'floor', 'trap', 'floor', 'floor', 'exit'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ],
};

const validFacts = {
  player: { x: 1, y: 2 },
  monsters: [{ id: 'white-1', type: 'white', x: 3, y: 2 }],
  exit: { x: 5, y: 2 },
  doorsOpen: false,
  adjacentTiles: {
    up: 'floor',
    down: 'wall',
    left: 'floor',
    right: 'trap',
  },
};

test('DeepSeek 提示词包含快照并要求只输出中性事实', () => {
  const messages = buildDeepSeekMessages({
    levelId: 'level-1',
    player: { x: 1, y: 1 },
    tiles: [['floor']],
  });
  const text = JSON.stringify(messages);
  assert.match(text, /facts/);
  assert.match(text, /禁止/);
  assert.match(text, /level-1/);
});

test('解析 DeepSeek 返回的合法事实 JSON', () => {
  const facts = parseDeepSeekFacts(JSON.stringify({ facts: validFacts }));
  assert.deepEqual(facts, validFacts);
});

test('事实与快照一致时通过', () => {
  assert.deepEqual(validateFactsAgainstSnapshot(validFacts, matchingSnapshot), validFacts);
});

test('拒绝与快照不一致的事实', () => {
  assert.throws(
    () => validateFactsAgainstSnapshot({
      ...validFacts,
      player: { x: 2, y: 2 },
    }, matchingSnapshot),
    (error) => error.code === 'DEEPSEEK_FACTS_MISMATCH',
  );
});

test('解析时可剥离 JSON 代码块', () => {
  const facts = parseDeepSeekFacts(`\`\`\`json\n${JSON.stringify({ facts: validFacts })}\n\`\`\``);
  assert.equal(facts.player.x, 1);
});

test('拒绝包含方向建议的事实', () => {
  assert.throws(
    () => parseDeepSeekFacts(JSON.stringify({
      facts: { ...validFacts, recommendedAction: 'up' },
    })),
    (error) => error.code === 'DEEPSEEK_INVALID_FACTS',
  );
});

test('拒绝额外自由文本字段', () => {
  assert.throws(
    () => parseDeepSeekFacts(JSON.stringify({
      facts: { ...validFacts, observations: ['应该向左走'] },
    })),
    (error) => error.code === 'DEEPSEEK_INVALID_FACTS',
  );
});

test('拒绝缺少必要字段的事实', () => {
  assert.throws(
    () => parseDeepSeekFacts(JSON.stringify({ facts: { player: { x: 1, y: 2 } } })),
    (error) => error.code === 'DEEPSEEK_INVALID_FACTS',
  );
});

test('DeepSeek 分析器发送正确请求并返回 facts 与 usage', async () => {
  const calls = [];
  const analyzer = createDeepSeekAnalyzer({
    apiKey: 'test-key',
    baseUrl: 'https://example.test',
    model: 'deepseek-v4-flash',
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        model: 'deepseek-v4-flash',
        choices: [{ message: { content: JSON.stringify({ facts: validFacts }) } }],
        usage: { prompt_tokens: 12, completion_tokens: 8 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const result = await analyzer(matchingSnapshot);
  assert.equal(result.facts.player.x, 1);
  assert.equal(result.usage.prompt_tokens, 12);
  assert.equal(calls[0].url, 'https://example.test/v1/chat/completions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.stringify(JSON.parse(calls[0].options.body)).includes('test-key'), false);
});

test('DeepSeek 余额不足返回明确错误', async () => {
  const analyzer = createDeepSeekAnalyzer({
    apiKey: 'test-key',
    fetcher: async () => new Response(
      JSON.stringify({ error: { message: '余额不足，请先充值' } }),
      { status: 402, headers: { 'content-type': 'application/json' } },
    ),
  });

  await assert.rejects(
    () => analyzer({}),
    (error) => error.code === 'DEEPSEEK_BALANCE_REQUIRED' && error.status === 402,
  );
});
