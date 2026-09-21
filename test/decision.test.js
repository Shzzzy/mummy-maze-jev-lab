import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXED_RULES,
  SCORE_CRITERIA,
  SCORING_DIMENSIONS,
  buildJevScorePayload,
  getLegalDirections,
  parseJevScoreResponse,
  selectBestDirection,
} from '../server/decision.js';

function snapshot() {
  return {
    player: { x: 1, y: 1 },
    doorsOpen: false,
    tiles: [
      ['wall', 'wall', 'wall', 'wall'],
      ['wall', 'floor', 'gate', 'wall'],
      ['wall', 'floor', 'exit', 'wall'],
      ['wall', 'wall', 'wall', 'wall'],
    ],
  };
}

function scoreAnswer(score, confidence = 0.8) {
  return {
    type: 'score',
    score,
    confidence,
    probabilities: { 0: 0.1, 1: 0.9 },
    legend: { 0: '低', 1: '高' },
  };
}

test('合法性过滤排除墙和关闭闸门', () => {
  assert.deepEqual(getLegalDirections(snapshot()), ['down']);
});

test('Jev 评分请求只包含合法动作并注入固定规则与维度', () => {
  const payload = buildJevScorePayload({ player: { x: 1, y: 1 } }, ['up', 'right'], { summary: '中性分析', keyPoints: [] });
  assert.deepEqual(Object.keys(payload.questions), ['up_score', 'right_score']);
  assert.equal(payload.questions.up_score.type, 'score');
  assert.deepEqual(payload.questions.up_score.criteria, SCORE_CRITERIA);
  assert.deepEqual(payload.state.rules, FIXED_RULES);
  assert.deepEqual(payload.state.scoringDimensions, SCORING_DIMENSIONS);
  assert.equal(payload.state.analysis.summary, '中性分析');
});

test('解析 Jev 评分并归一化', () => {
  const result = parseJevScoreResponse({
    model: 'jev-1.13.0',
    answers: {
      up_score: scoreAnswer(5, 0.9),
      left_score: scoreAnswer(2, 0.6),
    },
    usage: { input_tokens: 20, output_tokens: 4 },
  }, ['up', 'left']);

  assert.equal(result.model, 'jev-1.13.0');
  assert.equal(result.scores.up.score, 5);
  assert.equal(result.scores.up.normalizedScore, 1);
  assert.equal(result.scores.left.normalizedScore, 0.4);
  assert.equal(result.usage.input_tokens, 20);
});

test('拒绝缺失评分的 Jev 响应', () => {
  assert.throws(
    () => parseJevScoreResponse({ answers: { up_score: scoreAnswer(1) } }, ['up', 'down']),
    (error) => error.code === 'JEV_INVALID_SCORE',
  );
});

test('拒绝越界评分和置信度', () => {
  assert.throws(
    () => parseJevScoreResponse({ answers: { up_score: scoreAnswer(99) } }, ['up']),
    (error) => error.code === 'JEV_INVALID_SCORE',
  );
  assert.throws(
    () => parseJevScoreResponse({ answers: { up_score: scoreAnswer(1, 2) } }, ['up']),
    (error) => error.code === 'JEV_INVALID_SCORE',
  );
});

test('选择最高分动作', () => {
  const best = selectBestDirection({
    up: { direction: 'up', score: 1, confidence: 1 },
    down: { direction: 'down', score: 4, confidence: 0.2 },
  }, ['up', 'down']);
  assert.equal(best.direction, 'down');
});

test('同分时选择更高置信度', () => {
  const best = selectBestDirection({
    up: { direction: 'up', score: 3, confidence: 0.4 },
    down: { direction: 'down', score: 3, confidence: 0.9 },
  }, ['up', 'down']);
  assert.equal(best.direction, 'down');
});

test('分数和置信度都相同时按固定顺序选择', () => {
  const best = selectBestDirection({
    right: { direction: 'right', score: 3, confidence: 0.8 },
    up: { direction: 'up', score: 3, confidence: 0.8 },
  }, ['up', 'right']);
  assert.equal(best.direction, 'up');
});

test('没有合法动作时拒绝执行', () => {
  assert.throws(
    () => selectBestDirection({}, []),
    (error) => error.code === 'NO_LEGAL_ACTION',
  );
});
