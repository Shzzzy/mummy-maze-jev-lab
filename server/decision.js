const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

const DIRECTION_ORDER = Object.freeze(['up', 'down', 'left', 'right']);

export const FIXED_RULES = Object.freeze([
  '玩家每次只能移动一格，移动后怪物才行动。',
  '玩家进入出口立即通关。',
  '玩家进入陷阱立即失败。',
  '玩家进入怪物所在格或怪物进入玩家所在格立即失败。',
  '白木乃伊优先水平追击，每回合最多移动两步。',
  '红木乃伊优先垂直追击，每回合最多移动两步。',
  '蝎子优先水平追击，每回合只移动一步。',
  '怪物被墙、关闭闸门、边界或另一只怪物阻挡时停止。',
  '任意单位进入钥匙格时切换全部闸门状态。',
  '关闭的闸门阻挡所有单位，打开的闸门可通行。',
]);

export const SCORING_DIMENSIONS = Object.freeze([
  Object.freeze({ id: 'survival', description: '执行动作后，本回合和近期生存风险是否可接受。' }),
  Object.freeze({ id: 'progress', description: '执行动作后，是否更接近出口或必要的钥匙与闸门目标。' }),
  Object.freeze({ id: 'mobility', description: '执行动作后，是否保留足够的后续可移动空间。' }),
  Object.freeze({ id: 'resource', description: '执行动作后，是否合理处理钥匙、闸门、陷阱或出口。' }),
]);

export const SCORE_CRITERIA = Object.freeze([
  '执行后立即失败或几乎必然失败',
  '风险很高，只有在没有其他可行动作时才合理',
  '风险较高或明显浪费回合，但没有立即失败',
  '风险可控，但既没有明显进展也没有明显损失',
  '风险较低，并且对通关有明确帮助',
  '安全性、进展性和后续机动性综合最佳',
]);

function createError(code, message, status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function tileAt(snapshot, x, y) {
  if (x < 0 || y < 0 || y >= snapshot.tiles.length || x >= snapshot.tiles[0].length) {
    return 'wall';
  }
  return snapshot.tiles[y][x];
}

export function getLegalDirections(snapshot) {
  if (!snapshot || !snapshot.player || !Array.isArray(snapshot.tiles)) {
    throw createError('INVALID_SNAPSHOT', '缺少合法游戏快照');
  }

  return DIRECTION_ORDER.filter((direction) => {
    const vector = DIRECTIONS[direction];
    const tile = tileAt(
      snapshot,
      snapshot.player.x + vector.x,
      snapshot.player.y + vector.y,
    );
    if (tile === 'wall') return false;
    if (tile === 'gate' && !snapshot.doorsOpen) return false;
    return true;
  });
}

export function buildJevScorePayload(facts, legalDirections, analysis = null) {
  if (!Array.isArray(legalDirections) || legalDirections.length === 0) {
    throw createError('NO_LEGAL_ACTION', '当前没有可评分动作');
  }

  const questions = {};
  for (const direction of legalDirections) {
    if (!DIRECTIONS[direction]) {
      throw createError('INVALID_DIRECTION', `非法动作：${direction}`);
    }
    questions[`${direction}_score`] = {
      type: 'score',
      instructions: `根据 facts、rules 和 scoringDimensions，对执行 ${direction} 的总体合理性评分。只评估 ${direction}，不与其他动作比较。`,
      criteria: [...SCORE_CRITERIA],
    };
  }

  return {
    model: 'jev-latest',
    state: {
      facts,
      ...(analysis ? { analysis } : {}),
      rules: [...FIXED_RULES],
      scoringDimensions: SCORING_DIMENSIONS.map((item) => ({ ...item })),
    },
    questions,
  };
}

export function parseJevScoreResponse(response, legalDirections) {
  const answers = response?.answers;
  if (!answers || typeof answers !== 'object') {
    throw createError('JEV_INVALID_SCORE', 'Jev 响应缺少 answers', 502);
  }

  const topLevel = SCORE_CRITERIA.length - 1;
  const scores = {};
  for (const direction of legalDirections) {
    const answer = answers[`${direction}_score`];
    if (!answer || answer.type !== 'score') {
      throw createError('JEV_INVALID_SCORE', `Jev 缺少 ${direction} 的评分`, 502);
    }
    if (!Number.isFinite(answer.score) || answer.score < 0 || answer.score > topLevel) {
      throw createError('JEV_INVALID_SCORE', `Jev 的 ${direction} 评分越界`, 502);
    }
    if (!Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) {
      throw createError('JEV_INVALID_SCORE', `Jev 的 ${direction} 置信度越界`, 502);
    }
    if (!answer.probabilities || typeof answer.probabilities !== 'object') {
      throw createError('JEV_INVALID_SCORE', `Jev 的 ${direction} 缺少概率分布`, 502);
    }

    scores[direction] = {
      direction,
      score: answer.score,
      normalizedScore: answer.score / topLevel,
      confidence: answer.confidence,
      probabilities: { ...answer.probabilities },
      legend: { ...(answer.legend ?? {}) },
    };
  }

  return {
    model: response.model || 'jev-latest',
    scores,
    usage: response.usage ?? {},
  };
}

export function selectBestDirection(scores, legalDirections) {
  if (!Array.isArray(legalDirections) || legalDirections.length === 0) {
    throw createError('NO_LEGAL_ACTION', '当前没有可执行动作');
  }

  const candidates = legalDirections.map((direction) => {
    const score = scores?.[direction];
    if (!score) {
      throw createError('JEV_INVALID_SCORE', `缺少 ${direction} 的评分`, 502);
    }
    return score;
  });

  candidates.sort((left, right) => (
    right.score - left.score
    || right.confidence - left.confidence
    || legalDirections.indexOf(left.direction) - legalDirections.indexOf(right.direction)
  ));

  return { ...candidates[0] };
}
