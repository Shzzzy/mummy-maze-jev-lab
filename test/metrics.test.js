import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/engine.js';
import { createSnapshot } from '../src/engine/snapshot.js';
import { createMetrics, createExport, recordDecision, summarizeMetrics } from '../src/ui/metrics.js';

test('指标正确计算平均置信度、耗时和两类 token', () => {
  const metrics = createMetrics();
  recordDecision(metrics, {
    direction: 'up',
    score: 4,
    confidence: 0.8,
    latencyMs: 1000,
    analysisUsage: { prompt_tokens: 20, completion_tokens: 5 },
    scoringUsage: { input_tokens: 30, output_tokens: 7 },
  });
  recordDecision(metrics, {
    direction: 'down',
    score: 3,
    confidence: 0.6,
    latencyMs: 3000,
    analysisUsage: { prompt_tokens: 10, completion_tokens: 2 },
    scoringUsage: { input_tokens: 20, output_tokens: 3 },
  });
  const summary = summarizeMetrics(metrics);
  assert.equal(summary.averageConfidence, 0.7);
  assert.equal(summary.averageLatencyMs, 2000);
  assert.equal(summary.totalTokens, 97);
});

test('快照复制可变状态', () => {
  const state = createGame({
    id: 'snapshot',
    name: '快照',
    tiles: ['#####', '#P.W#', '#####'],
    monsters: [],
    doorsOpen: false,
  });
  const snapshot = createSnapshot(state);
  snapshot.player.x = 99;
  snapshot.monsters[0].x = 99;
  assert.equal(state.player.x, 1);
  assert.equal(state.monsters[0].x, 3);
});

test('导出包含模型、汇总、会话、评分和两类 usage', () => {
  const metrics = createMetrics();
  recordDecision(metrics, {
    direction: 'right',
    score: 5,
    confidence: 0.9,
    latencyMs: 1200,
    scores: {
      right: { direction: 'right', score: 5, confidence: 0.9 },
    },
    facts: { player: { x: 1, y: 1 } },
    analysisUsage: { prompt_tokens: 10, completion_tokens: 2 },
    scoringUsage: { input_tokens: 8, output_tokens: 3 },
  });
  const exported = createExport(metrics);
  assert.equal(exported.model, 'jev-latest');
  assert.equal(exported.decisions.length, 1);
  assert.equal(exported.decisions[0].scores.right.score, 5);
  assert.equal(exported.decisions[0].facts.player.x, 1);
  assert.equal(exported.decisions[0].analysisUsage.prompt_tokens, 10);
  assert.equal(exported.decisions[0].scoringUsage.input_tokens, 8);
  assert.ok(exported.exportedAt);
});
