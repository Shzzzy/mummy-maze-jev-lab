const DEFAULT_BASE_URL = 'https://omnilabs.vibeadmin.cn';

function directionCriteria() {
  return {
    up: '向上移动一格，并触发怪物回合。',
    down: '向下移动一格，并触发怪物回合。',
    left: '向左移动一格，并触发怪物回合。',
    right: '向右移动一格，并触发怪物回合。',
  };
}

export function buildSystemOnePayload(snapshot) {
  return {
    model: 'jev-latest',
    state: {
      game: '木乃伊迷宫',
      objective: '避开木乃伊和蝎子并到达出口',
      snapshot,
    },
    questions: {
      toward_exit: {
        type: 'noul',
        instructions: '本回合优先靠近出口是最佳策略。',
        criteria: {
          true: '靠近出口能增加安全通关概率。',
          false: '应先绕路、处理怪物位置或等待合适时机。',
        },
      },
      next_move: {
        type: 'choice',
        instructions: '探险家下一步应向上、下、左、右中的哪个方向移动一格，才能最大化通关概率？',
        criteria: directionCriteria(),
      },
    },
  };
}

export function parseSystemOneResponse(response) {
  const towardExit = response?.answers?.toward_exit;
  const nextMove = response?.answers?.next_move;
  const allowed = new Set(['up', 'down', 'left', 'right']);

  if (towardExit?.type !== 'noul' || typeof towardExit.noul !== 'number') {
    throw new Error('INVALID_TOWARD_EXIT');
  }
  if (nextMove?.type !== 'choice' || !allowed.has(nextMove.choice)) {
    throw new Error('INVALID_DIRECTION');
  }

  return {
    direction: nextMove.choice,
    confidence: nextMove.confidence,
    probabilities: nextMove.probabilities,
    yesProbability: towardExit.noul,
    noProbability: 1 - towardExit.noul,
    usage: response.usage ?? { input_tokens: 0, output_tokens: 0 },
  };
}

export function createJevHandler({
  fetcher = fetch,
  apiKey = process.env.OMNILABS_API_KEY,
  baseUrl = process.env.OMNILABS_BASE_URL || DEFAULT_BASE_URL,
  timeoutMs = 20_000,
} = {}) {
  return async (request, response) => {
    if (!apiKey) {
      response.status(503).json({
        error: 'JEV_NOT_CONFIGURED',
        message: '缺少 OMNILABS_API_KEY',
      });
      return;
    }

    const startedAt = performance.now();
    try {
      const upstream = await fetcher(`${baseUrl}/v1/systemone`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildSystemOnePayload(request.body)),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await upstream.text();

      if (!upstream.ok) {
        response.status(upstream.status).json({
          error: 'UPSTREAM_ERROR',
          message: text.slice(0, 500),
        });
        return;
      }

      const parsed = parseSystemOneResponse(JSON.parse(text));
      response.json({
        ...parsed,
        latencyMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      const isTimeout = error.name === 'TimeoutError';
      response.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? 'JEV_TIMEOUT' : 'JEV_REQUEST_FAILED',
        message: error.message,
      });
    }
  };
}
