const DEFAULT_BASE_URL = 'https://omnilabs.vibeadmin.cn';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const FORBIDDEN_KEYS = new Set([
  'action',
  'actions',
  'bestaction',
  'choice',
  'direction',
  'ranking',
  'recommendation',
  'recommendedaction',
  'score',
  'scores',
]);

function createError(code, message, status = 502) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function hasForbiddenKey(value) {
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item));
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(([key, child]) => (
    FORBIDDEN_KEYS.has(key.toLowerCase()) || hasForbiddenKey(child)
  ));
}

function isPoint(value) {
  return value
    && typeof value === 'object'
    && Number.isFinite(value.x)
    && Number.isFinite(value.y);
}

function validateFacts(facts) {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 必须是对象');
  }
  if (hasForbiddenKey(facts)) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 包含动作相关字段');
  }
  if (!isPoint(facts.player)) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 缺少合法 player');
  }
  if (!Array.isArray(facts.monsters)) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 缺少 monsters 数组');
  }
  if (facts.exit !== null && !isPoint(facts.exit)) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 的 exit 非法');
  }
  if (typeof facts.doorsOpen !== 'boolean') {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 缺少 doorsOpen');
  }
  if (!facts.adjacentTiles || typeof facts.adjacentTiles !== 'object') {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 缺少 adjacentTiles');
  }
  for (const direction of ['up', 'down', 'left', 'right']) {
    if (typeof facts.adjacentTiles[direction] !== 'string') {
      throw createError('DEEPSEEK_INVALID_FACTS', `DeepSeek facts 缺少 ${direction} 相邻格`);
    }
  }
  return facts;
}

function stripCodeFence(content) {
  const trimmed = String(content ?? '').trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export function buildDeepSeekMessages(snapshot) {
  return [
    {
      role: 'system',
      content: [
        '你是局面事实整理器，不是决策器。',
        '只整理输入快照中的客观事实，并严格输出 JSON。',
        '禁止输出任何方向建议、动作排名、动作评分、推荐动作或策略偏好。',
        '不能修改游戏规则，不能补充输入中没有出现的事实。',
      ].join(''),
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: '整理当前局面，输出中性 facts。',
        output: {
          facts: {
            player: { x: 0, y: 0 },
            monsters: [{ id: 'string', type: 'white|red|scorpion', x: 0, y: 0 }],
            exit: { x: 0, y: 0 },
            doorsOpen: true,
            adjacentTiles: {
              up: 'floor|wall|exit|trap|key|gate',
              down: 'floor|wall|exit|trap|key|gate',
              left: 'floor|wall|exit|trap|key|gate',
              right: 'floor|wall|exit|trap|key|gate',
            },
            observations: ['只允许客观描述，不得包含动作建议'],
          },
        },
        snapshot,
      }),
    },
  ];
}

export function parseDeepSeekFacts(content) {
  let payload;
  try {
    payload = JSON.parse(stripCodeFence(content));
  } catch {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek 没有返回合法 JSON');
  }
  return validateFacts(payload.facts);
}

export function createDeepSeekAnalyzer({
  fetcher = fetch,
  apiKey = process.env.OMNILABS_API_KEY,
  baseUrl = process.env.OMNILABS_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
  timeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 20_000),
} = {}) {
  return async (snapshot) => {
    if (!apiKey) {
      throw createError('DEEPSEEK_NOT_CONFIGURED', '缺少 OMNILABS_API_KEY', 503);
    }

    const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: buildDeepSeekMessages(snapshot),
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await response.text();
    if (!response.ok) {
      let message = text.slice(0, 500);
      try {
        const body = JSON.parse(text);
        message = body.error?.message || message;
      } catch {
        // 保留原始错误文本
      }
      if (response.status === 402) {
        throw createError('DEEPSEEK_BALANCE_REQUIRED', message || 'DeepSeek 余额不足', 402);
      }
      throw createError('DEEPSEEK_UPSTREAM_ERROR', message || 'DeepSeek 请求失败', response.status);
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek 响应不是 JSON');
    }

    const content = body.choices?.[0]?.message?.content;
    const facts = parseDeepSeekFacts(content);
    return {
      facts,
      model: body.model || model,
      usage: body.usage ?? {},
    };
  };
}

export function mapDeepSeekError(error) {
  if (error.name === 'TimeoutError') {
    return createError('DEEPSEEK_TIMEOUT', 'DeepSeek 响应超时', 504);
  }
  return error;
}
