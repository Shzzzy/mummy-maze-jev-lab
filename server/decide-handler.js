import {
  createDeepSeekAnalyzer,
  mapDeepSeekError,
} from './analysis.js';
import {
  buildJevScorePayload,
  getLegalDirections,
  parseJevScoreResponse,
  selectBestDirection,
} from './decision.js';

const DEFAULT_BASE_URL = 'https://omnilabs.vibeadmin.cn';

function createError(code, message, status = 502) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function createJevScorer({
  fetcher = fetch,
  apiKey = process.env.OMNILABS_API_KEY,
  baseUrl = process.env.OMNILABS_BASE_URL || DEFAULT_BASE_URL,
  timeoutMs = Number(process.env.JEV_TIMEOUT_MS || 20_000),
} = {}) {
  return async (payload, legalDirections) => {
    if (!apiKey) {
      throw createError('JEV_NOT_CONFIGURED', '缺少 OMNILABS_API_KEY', 503);
    }

    let response;
    let text;
    try {
      response = await fetcher(`${baseUrl.replace(/\/$/, '')}/v1/systemone`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      text = await response.text();
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw createError('JEV_TIMEOUT', 'Jev 响应超时', 504);
      }
      throw error;
    }
    if (!response.ok) {
      let message = text.slice(0, 500);
      try {
        const body = JSON.parse(text);
        message = body.message || body.error?.message || message;
      } catch {
        // 保留原始错误文本
      }
      throw createError('JEV_UPSTREAM_ERROR', message || 'Jev 请求失败', response.status);
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw createError('JEV_INVALID_RESPONSE', 'Jev 响应不是 JSON');
    }

    return parseJevScoreResponse(body, legalDirections);
  };
}

export function createDecisionHandler({
  analyze = createDeepSeekAnalyzer(),
  score = createJevScorer(),
} = {}) {
  return async (request, response) => {
    const startedAt = performance.now();
    try {
      const snapshot = request.body;
      const legalDirections = getLegalDirections(snapshot);
      const analysis = await analyze(snapshot);
      const jevPayload = buildJevScorePayload(analysis.facts, legalDirections);
      const scored = await score(jevPayload, legalDirections);
      const best = selectBestDirection(scored.scores, legalDirections);

      response.json({
        model: scored.model,
        direction: best.direction,
        score: best.score,
        confidence: best.confidence,
        scores: scored.scores,
        facts: analysis.facts,
        rules: jevPayload.state.rules,
        scoringDimensions: jevPayload.state.scoringDimensions,
        analysisUsage: analysis.usage ?? {},
        scoringUsage: scored.usage ?? {},
        latencyMs: Math.round(performance.now() - startedAt),
      });
    } catch (rawError) {
      const error = mapDeepSeekError(rawError);
      response.status(error.status || 502).json({
        error: error.code || 'DECISION_FAILED',
        message: error.message,
      });
    }
  };
}
