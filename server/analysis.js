const DEFAULT_BASE_URL = 'https://omnilabs.vibeadmin.cn';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const FACT_KEYS = new Set(['player', 'monsters', 'exit', 'doorsOpen', 'adjacentTiles']);
const POINT_KEYS = new Set(['x', 'y']);
const MONSTER_KEYS = new Set(['id', 'type', 'x', 'y']);
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
    && !Array.isArray(value)
    && Object.keys(value).every((key) => POINT_KEYS.has(key))
    && Number.isFinite(value.x)
    && Number.isFinite(value.y);
}

function validateFacts(facts) {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 必须是对象');
  }
  if (Object.keys(facts).some((key) => !FACT_KEYS.has(key))) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 包含额外字段');
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
  for (const monster of facts.monsters) {
    if (!monster || typeof monster !== 'object' || Array.isArray(monster)) {
      throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek monsters 元素必须是对象');
    }
    if (Object.keys(monster).some((key) => !MONSTER_KEYS.has(key))) {
      throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek monster 包含额外字段');
    }
    if (
      typeof monster.id !== 'string'
      || typeof monster.type !== 'string'
      || !Number.isFinite(monster.x)
      || !Number.isFinite(monster.y)
    ) {
      throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek monster 字段非法');
    }
  }
  if (facts.exit !== null && !isPoint(facts.exit)) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 的 exit 非法');
  }
  if (typeof facts.doorsOpen !== 'boolean') {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 缺少 doorsOpen');
  }
  if (!facts.adjacentTiles || typeof facts.adjacentTiles !== 'object' || Array.isArray(facts.adjacentTiles)) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek facts 缺少 adjacentTiles');
  }
  const adjacentKeys = Object.keys(facts.adjacentTiles);
  if (
    adjacentKeys.length !== 4
    || adjacentKeys.some((direction) => !['up', 'down', 'left', 'right'].includes(direction))
  ) {
    throw createError('DEEPSEEK_INVALID_FACTS', 'DeepSeek adjacentTiles 字段非法');
  }
  for (const direction of ['up', 'down', 'left', 'right']) {
    if (typeof facts.adjacentTiles[direction] !== 'string') {
      throw createError('DEEPSEEK_INVALID_FACTS', `DeepSeek facts 缺少 ${direction} 相邻格`);
    }
  }
  return facts;
}


function tileAt(snapshot, x, y) {
  if (x < 0 || y < 0 || y >= snapshot.tiles.length || x >= snapshot.tiles[0].length) {
    return 'wall';
  }
  return snapshot.tiles[y][x];
}

function findExit(snapshot) {
  for (let y = 0; y < snapshot.tiles.length; y += 1) {
    for (let x = 0; x < snapshot.tiles[y].length; x += 1) {
      if (snapshot.tiles[y][x] === 'exit') return { x, y };
    }
  }
  return null;
}

export function validateFactsAgainstSnapshot(facts, snapshot) {
  if (!snapshot || !snapshot.player || !Array.isArray(snapshot.tiles)) {
    throw createError('INVALID_SNAPSHOT', '缺少合法游戏快照', 422);
  }
  if (facts.player.x !== snapshot.player.x || facts.player.y !== snapshot.player.y) {
    throw createError('DEEPSEEK_FACTS_MISMATCH', 'DeepSeek player 与快照不一致');
  }
  if (facts.doorsOpen !== Boolean(snapshot.doorsOpen)) {
    throw createError('DEEPSEEK_FACTS_MISMATCH', 'DeepSeek doorsOpen 与快照不一致');
  }

  const exit = findExit(snapshot);
  if (exit === null) {
    if (facts.exit !== null) {
      throw createError('DEEPSEEK_FACTS_MISMATCH', 'DeepSeek exit 与快照不一致');
    }
  } else if (!facts.exit || facts.exit.x !== exit.x || facts.exit.y !== exit.y) {
    throw createError('DEEPSEEK_FACTS_MISMATCH', 'DeepSeek exit 与快照不一致');
  }

  const monsters = snapshot.monsters ?? [];
  if (facts.monsters.length !== monsters.length) {
    throw createError('DEEPSEEK_FACTS_MISMATCH', 'DeepSeek monsters 数量与快照不一致');
  }
  for (const monster of monsters) {
    const item = facts.monsters.find((candidate) => candidate.id === monster.id);
    if (!item || item.type !== monster.type || item.x !== monster.x || item.y !== monster.y) {
      throw createError('DEEPSEEK_FACTS_MISMATCH', `DeepSeek ${monster.id} 与快照不一致`);
    }
  }

  const vectors = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  for (const [direction, vector] of Object.entries(vectors)) {
    const expected = tileAt(snapshot, snapshot.player.x + vector.x, snapshot.player.y + vector.y);
    if (facts.adjacentTiles[direction] !== expected) {
      throw createError('DEEPSEEK_FACTS_MISMATCH', `DeepSeek ${direction} 相邻格与快照不一致`);
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
    const facts = validateFactsAgainstSnapshot(parseDeepSeekFacts(content), snapshot);
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
