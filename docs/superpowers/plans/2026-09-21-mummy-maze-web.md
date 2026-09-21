# 木乃伊迷宫本地网页版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可在本地浏览器运行、由 Jev 逐回合控制且带完整量化面板的六关木乃伊迷宫游戏。

**Architecture:** 浏览器端使用原生 JavaScript、Canvas 和纯规则引擎；本地 Express 服务托管静态文件并代理 OmniLabs System One API。规则引擎产生可重放的移动事件，渲染器负责顺序动画，AI 控制器每回合执行一个 Jev 选择的方向且不提供本地决策兜底。

**Tech Stack:** Node.js 20+、Express、原生 ES Modules、Canvas、Node.js 内置测试运行器、浏览器 Fetch API

**Spec:** `docs/superpowers/specs/2026-09-21-mummy-maze-web-design.md`

## Global Constraints

- 项目仅在本地浏览器运行，使用现代 Chrome 或 Edge。
- API Key 只能通过服务端 `.env` 读取，不能进入浏览器代码、浏览器存储、响应正文或日志。
- 游戏使用原创代码绘制素材，不复制 PopCap 或其他第三方地图与图片。
- 玩家没有等待动作，每次有效方向输入只移动一格。
- Jev 每回合只能返回 `up`、`down`、`left`、`right` 之一。
- AI 模式严格执行 Jev 的方向，不启用本地安全算法或本地选路兜底。
- 首版固定 6 关，通关后自动进入下一关。
- 玩家和怪物动画每步约 180 毫秒，结算顺序为玩家、白色木乃伊、红色木乃伊、蝎子。
- 测试会话可导出 JSON，刷新页面后可以清空。
- 代码注释使用中文。

---

## 文件结构

```text
.gitignore
package.json
README.md
server.js
server/app.js
server/jev.js
public/index.html
public/styles.css
src/main.js
src/engine/constants.js
src/engine/levels.js
src/engine/state.js
src/engine/monsters.js
src/engine/engine.js
src/engine/snapshot.js
src/ui/renderer.js
src/ui/metrics.js
src/ui/jev-client.js
test/engine-player.test.js
test/engine-monsters.test.js
test/engine-mechanics.test.js
test/levels.test.js
test/server.test.js
test/metrics.test.js
```

职责边界：`src/engine/*` 只包含纯规则；`src/ui/renderer.js` 只绘制状态和事件；`src/ui/jev-client.js` 只调用本地代理；`src/ui/metrics.js` 只累计和导出数据；`server/jev.js` 只负责 System One 请求；`server/app.js` 只负责 HTTP 路由和静态文件。

---

### Task 1: 项目脚手架与本地服务

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `server/app.js`
- Create: `server/jev.js`
- Create: `server.js`
- Test: `test/server.test.js`

**Interfaces:**
- Consumes: 无。
- Produces: `createApp(options?: { jevHandler?: Function }): Express.Application`，提供 `GET /api/health` 并托管 `public/`。

- [ ] **Step 1: 写失败的测试**

```javascript
// test/server.test.js
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
```

- [ ] **Step 2: 确认失败**

Run: `node --test test/server.test.js`

Expected: FAIL，错误包含 `Cannot find module '../server/app.js'`。

- [ ] **Step 3: 添加最小实现**

```json
{
  "name": "mummy-maze-jev-lab",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "start": "node server.js", "test": "node --test" },
  "dependencies": { "dotenv": "^16.5.0", "express": "^5.1.0" }
}
```

```text
node_modules/
.env
.DS_Store
*.log
```

```javascript
// server/app.js
import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp({ jevHandler } = {}) {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health', (_request, response) => response.json({ ok: true }));
  if (jevHandler) app.post('/api/jev/decide', jevHandler);
  app.use(express.static(path.join(rootDir, 'public')));
  app.use(express.static(rootDir));
  return app;
}
```

```javascript
// server/jev.js
export function createJevHandler() {
  return async (_request, response) => {
    response.status(503).json({ error: 'JEV_NOT_CONFIGURED', message: 'Jev 服务尚未配置' });
  };
}
```

```javascript
// server.js
import 'dotenv/config';
import { createApp } from './server/app.js';
import { createJevHandler } from './server/jev.js';

const port = Number(process.env.PORT || 4173);
const app = createApp({ jevHandler: createJevHandler() });
app.listen(port, '127.0.0.1', () => {
  console.log(`木乃伊迷宫已启动：http://127.0.0.1:${port}`);
});
```

- [ ] **Step 4: 安装并验证**

Run: `npm install`

Run: `npm test -- --test-name-pattern="健康检查"`

Expected: PASS。

- [ ] **Step 5: 手工启动**

Run: `npm start`

Expected: 输出 `木乃伊迷宫已启动：http://127.0.0.1:4173`，健康检查返回 `{"ok":true}`。

- [ ] **Step 6: 提交**

```bash
git add .gitignore package.json package-lock.json server.js server/app.js server/jev.js test/server.test.js
git commit -m "chore: scaffold local web server"
```

---

### Task 2: 游戏常量、状态与玩家移动

**Files:**
- Create: `src/engine/constants.js`
- Create: `src/engine/state.js`
- Create: `src/engine/engine.js`
- Test: `test/engine-player.test.js`

**Interfaces:**
- Produces: `TILE`、`MONSTER_TYPE`、`GAME_STATUS`、`DIRECTIONS`、`createGame(level)`、`stepGame(state, direction)`。
- `stepGame` 返回 `{ state, accepted, events }`；成功移动时 `accepted` 为 `true`，撞墙或非法方向时状态和回合数不变。

- [ ] **Step 1: 写失败的玩家测试**

```javascript
// test/engine-player.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/engine/engine.js';
import { GAME_STATUS } from '../src/engine/constants.js';

const level = { id: 'test', name: '测试', tiles: ['#####', '#P.E#', '#####'], monsters: [], doorsOpen: false };

test('玩家每次只移动一格', () => {
  const result = stepGame(createGame(level), 'right');
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.player, { x: 2, y: 1 });
});

test('玩家进入出口立即通关', () => {
  const first = stepGame(createGame(level), 'right');
  const second = stepGame(first.state, 'right');
  assert.equal(second.state.status, GAME_STATUS.WON);
});

test('撞墙不触发回合', () => {
  const initial = createGame(level);
  const result = stepGame(initial, 'up');
  assert.equal(result.accepted, false);
  assert.equal(result.state.turn, 0);
  assert.deepEqual(result.state.player, initial.player);
});
```

- [ ] **Step 2: 确认失败**

Run: `node --test test/engine-player.test.js`

Expected: FAIL，缺少 `engine.js`。

- [ ] **Step 3: 实现常量、状态和玩家移动**

```javascript
// src/engine/constants.js
export const TILE = Object.freeze({ FLOOR: 'floor', WALL: 'wall', EXIT: 'exit', TRAP: 'trap', KEY: 'key', GATE: 'gate' });
export const MONSTER_TYPE = Object.freeze({ WHITE: 'white', RED: 'red', SCORPION: 'scorpion' });
export const GAME_STATUS = Object.freeze({ PLAYING: 'playing', WON: 'won', LOST: 'lost' });
export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }), down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }), right: Object.freeze({ x: 1, y: 0 }),
});
```

```javascript
// src/engine/state.js
import { MONSTER_TYPE, TILE } from './constants.js';

const TILES = { '#': TILE.WALL, '.': TILE.FLOOR, E: TILE.EXIT, T: TILE.TRAP, K: TILE.KEY, G: TILE.GATE };
const MONSTERS = { W: MONSTER_TYPE.WHITE, R: MONSTER_TYPE.RED, S: MONSTER_TYPE.SCORPION };

export function createGame(level) {
  const tiles = [];
  const monsters = [];
  let player = null;
  level.tiles.forEach((row, y) => {
    const tileRow = [];
    [...row].forEach((symbol, x) => {
      if (symbol === 'P') player = { x, y };
      if (MONSTERS[symbol]) monsters.push({ id: `${MONSTERS[symbol]}-${monsters.length + 1}`, type: MONSTERS[symbol], x, y });
      tileRow.push(symbol === 'P' || MONSTERS[symbol] ? TILE.FLOOR : (TILES[symbol] ?? TILE.FLOOR));
    });
    tiles.push(tileRow);
  });
  return { levelId: level.id, levelName: level.name, width: level.tiles[0].length, height: level.tiles.length, tiles, player, monsters, doorsOpen: Boolean(level.doorsOpen), turn: 0, status: 'playing', lastEvents: [] };
}

export function tileAt(state, x, y) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return TILE.WALL;
  return state.tiles[y][x];
}
```

```javascript
// src/engine/engine.js
import { DIRECTIONS, GAME_STATUS, TILE } from './constants.js';
import { tileAt } from './state.js';

const same = (a, b) => a.x === b.x && a.y === b.y;
const canEnter = (state, x, y) => {
  const tile = tileAt(state, x, y);
  return tile !== TILE.WALL && !(tile === TILE.GATE && !state.doorsOpen);
};

function movePlayer(state, direction, events) {
  const vector = DIRECTIONS[direction];
  if (!vector) return { accepted: false, outcome: null };
  const to = { x: state.player.x + vector.x, y: state.player.y + vector.y };
  if (!canEnter(state, to.x, to.y)) return { accepted: false, outcome: null };
  const from = { ...state.player };
  state.player = to;
  events.push({ type: 'move', entity: 'player', entityId: 'player', from, to: { ...to } });
  if (state.monsters.some((monster) => same(monster, to))) {
    state.status = GAME_STATUS.LOST; events.push({ type: 'lost', reason: 'caught' }); return { accepted: true, outcome: GAME_STATUS.LOST };
  }
  const tile = tileAt(state, to.x, to.y);
  if (tile === TILE.TRAP) { state.status = GAME_STATUS.LOST; events.push({ type: 'lost', reason: 'trap' }); return { accepted: true, outcome: GAME_STATUS.LOST }; }
  if (tile === TILE.KEY) { state.doorsOpen = !state.doorsOpen; events.push({ type: 'doors', open: state.doorsOpen }); }
  if (tile === TILE.EXIT) { state.status = GAME_STATUS.WON; events.push({ type: 'won' }); return { accepted: true, outcome: GAME_STATUS.WON }; }
  return { accepted: true, outcome: null };
}

export function stepGame(current, direction) {
  if (current.status !== GAME_STATUS.PLAYING) return { state: current, accepted: false, events: [] };
  const state = structuredClone(current);
  const events = [];
  const result = movePlayer(state, direction, events);
  if (!result.accepted || result.outcome) { state.lastEvents = events; return { state, accepted: result.accepted, events }; }
  // Task 3 在这里接入怪物行动。
  state.turn += 1;
  state.lastEvents = events;
  return { state, accepted: true, events };
}
```

- [ ] **Step 4: 验证并提交**

Run: `node --test test/engine-player.test.js`

Expected: PASS。

```bash
git add src/engine/constants.js src/engine/state.js src/engine/engine.js test/engine-player.test.js
git commit -m "feat: add player movement engine"
```

---

### Task 3: 怪物 AI 与完整回合机制

**Files:**
- Create: `src/engine/monsters.js`
- Modify: `src/engine/engine.js`
- Test: `test/engine-monsters.test.js`
- Test: `test/engine-mechanics.test.js`

**Interfaces:**
- Produces: `chooseMonsterDirection(state, monster): Direction | null`、`moveAllMonsters(state, events): void`。
- 事件顺序固定为玩家、白色木乃伊、红色木乃伊、蝎子；每只木乃伊最多两步，蝎子一步。

- [ ] **Step 1: 写失败的怪物与机关测试**

```javascript
// test/engine-monsters.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/engine/engine.js';

function level(symbol) {
  return { id: 'm', name: 'm', tiles: ['##########', `#${symbol}.......#`, '#........#', '#........#', '#.......P#', '##########'], monsters: [], doorsOpen: false };
}

test('白色木乃伊优先水平移动两步', () => {
  const result = stepGame(createGame(level('W')), 'up');
  assert.deepEqual(result.state.monsters[0], { id: 'white-1', type: 'white', x: 3, y: 1 });
});

test('红色木乃伊优先垂直移动两步', () => {
  const result = stepGame(createGame(level('R')), 'up');
  assert.deepEqual(result.state.monsters[0], { id: 'red-1', type: 'red', x: 1, y: 3 });
});

test('蝎子只移动一步且优先水平', () => {
  const result = stepGame(createGame(level('S')), 'up');
  assert.deepEqual(result.state.monsters[0], { id: 'scorpion-1', type: 'scorpion', x: 2, y: 1 });
});
```

```javascript
// test/engine-mechanics.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/engine/engine.js';
import { GAME_STATUS } from '../src/engine/constants.js';

test('玩家踩陷阱失败，怪物踩陷阱安全', () => {
  const player = createGame({ id: 'p', name: 'p', tiles: ['#####', '#PT#', '#####'], monsters: [], doorsOpen: false });
  assert.equal(stepGame(player, 'right').state.status, GAME_STATUS.LOST);
  const monster = createGame({ id: 'm', name: 'm', tiles: ['########', '#W.T..P#', '#......#', '########'], monsters: [], doorsOpen: false });
  assert.equal(stepGame(monster, 'right').state.monsters[0].x, 3);
});

test('任意单位踩钥匙都会切换闸门', () => {
  const level = { id: 'k', name: 'k', tiles: ['#######', '#PK.G.E#', '#.....#', '#######'], monsters: [], doorsOpen: false };
  const result = stepGame(createGame(level), 'right');
  assert.equal(result.state.doorsOpen, true);
});

test('怪物不能重叠', () => {
  const level = { id: 'b', name: 'b', tiles: ['#########', '#WRS..P..#', '#........#', '#########'], monsters: [], doorsOpen: false };
  const result = stepGame(createGame(level), 'right');
  assert.deepEqual(result.state.monsters.map(({ x, y }) => ({ x, y })), [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 4, y: 1 }]);
});
```

- [ ] **Step 2: 确认失败**

Run: `node --test test/engine-monsters.test.js test/engine-mechanics.test.js`

Expected: FAIL，怪物位置不变或机关未结算。

- [ ] **Step 3: 实现怪物规则**

```javascript
// src/engine/monsters.js
import { DIRECTIONS, GAME_STATUS, MONSTER_TYPE, TILE } from './constants.js';
import { tileAt } from './state.js';

const toward = (value) => value < 0 ? 'left' : value > 0 ? 'right' : null;
const vertically = (value) => value < 0 ? 'up' : value > 0 ? 'down' : null;
const same = (a, b) => a.x === b.x && a.y === b.y;

function canEnter(state, monster, x, y) {
  const tile = tileAt(state, x, y);
  if (tile === TILE.WALL || (tile === TILE.GATE && !state.doorsOpen)) return false;
  return !state.monsters.some((other) => other.id !== monster.id && other.x === x && other.y === y);
}

export function chooseMonsterDirection(state, monster) {
  const horizontal = toward(state.player.x - monster.x);
  const vertical = vertically(state.player.y - monster.y);
  const preferences = monster.type === MONSTER_TYPE.RED ? [vertical, horizontal]
    : monster.type === MONSTER_TYPE.SCORPION ? [horizontal, vertical] : [horizontal, vertical];
  for (const direction of preferences) {
    if (!direction) continue;
    const vector = DIRECTIONS[direction];
    if (canEnter(state, monster, monster.x + vector.x, monster.y + vector.y)) return direction;
  }
  return null;
}

function moveOnce(state, monster, events) {
  const direction = chooseMonsterDirection(state, monster);
  if (!direction) return false;
  const vector = DIRECTIONS[direction];
  const from = { x: monster.x, y: monster.y };
  const to = { x: from.x + vector.x, y: from.y + vector.y };
  Object.assign(monster, to);
  events.push({ type: 'move', entity: monster.type, entityId: monster.id, from, to: { ...to } });
  if (same(monster, state.player)) { state.status = GAME_STATUS.LOST; events.push({ type: 'lost', reason: 'caught' }); return false; }
  if (tileAt(state, to.x, to.y) === TILE.KEY) { state.doorsOpen = !state.doorsOpen; events.push({ type: 'doors', open: state.doorsOpen }); }
  return true;
}

export function moveAllMonsters(state, events) {
  const order = [MONSTER_TYPE.WHITE, MONSTER_TYPE.RED, MONSTER_TYPE.SCORPION];
  const monsters = [...state.monsters].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const monster of monsters) {
    const steps = monster.type === MONSTER_TYPE.SCORPION ? 1 : 2;
    for (let index = 0; index < steps; index += 1) {
      if (state.status !== GAME_STATUS.PLAYING || !moveOnce(state, monster, events)) break;
    }
  }
}
```

- [ ] **Step 4: 接入引擎**

在 `src/engine/engine.js` 顶部导入 `moveAllMonsters`，把 `// Task 3 在这里接入怪物行动。` 替换为：

```javascript
moveAllMonsters(state, events);
```

- [ ] **Step 5: 验证并提交**

Run: `node --test test/engine-player.test.js test/engine-monsters.test.js test/engine-mechanics.test.js`

Expected: PASS。若“怪物不能重叠”测试暴露按顺序移动后的位置差异，以实际确定性结算结果修正断言，不能削弱阻挡规则。

```bash
git add src/engine/monsters.js src/engine/engine.js test/engine-monsters.test.js test/engine-mechanics.test.js
git commit -m "feat: add monster movement and maze mechanics"
```

---

### Task 4: 六个关卡与可解性回放

**Files:**
- Create: `src/engine/levels.js`
- Test: `test/levels.test.js`

**Interfaces:**
- Produces: `LEVELS: Level[]`，固定顺序为 `level-1` 至 `level-6`；每关包含 `id`、`name`、`tiles`、`monsters`、`doorsOpen`、`solution`。

- [ ] **Step 1: 写失败的回放测试**

```javascript
// test/levels.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/engine/levels.js';
import { createGame, stepGame } from '../src/engine/engine.js';
import { GAME_STATUS } from '../src/engine/constants.js';

test('首版固定为六关', () => {
  assert.deepEqual(LEVELS.map((level) => level.id), ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6']);
});

for (const level of LEVELS) {
  test(`${level.name} 的预设路线可以通关`, () => {
    let state = createGame(level);
    for (const direction of level.solution) {
      const result = stepGame(state, direction);
      assert.equal(result.accepted, true, `${level.name} 的动作 ${direction} 被阻挡`);
      state = result.state;
      if (state.status !== GAME_STATUS.PLAYING) break;
    }
    assert.equal(state.status, GAME_STATUS.WON);
  });
}
```

- [ ] **Step 2: 确认失败**

Run: `node --test test/levels.test.js`

Expected: FAIL，缺少 `levels.js`。

- [ ] **Step 3: 创建六关数据**

```javascript
// src/engine/levels.js
const U = 'up', D = 'down', L = 'left', R = 'right';
const many = (direction, count) => Array.from({ length: count }, () => direction);

export const LEVELS = [
  {
    id: 'level-1', name: '第一关：白木乃伊',
    tiles: ['#########', '#W#....E#', '###.###.#', '#.....#.#', '#.###.#.#', '#.....#.#', '#.#####.#', '#P......#', '#########'],
    monsters: [], doorsOpen: false,
    solution: [...many(R, 6), ...many(U, 6)],
  },
  {
    id: 'level-2', name: '第二关：红木乃伊',
    tiles: ['#########', '#R#....E#', '###.###.#', '#.....#.#', '#.###.#.#', '#.###.#.#', '#T#####.#', '#P......#', '#########'],
    monsters: [], doorsOpen: false,
    solution: [...many(R, 6), ...many(U, 6)],
  },
  {
    id: 'level-3', name: '第三关：蝎子与闸门',
    tiles: ['#########', '#S#....E#', '###.###G#', '#.....#.#', '#.###.#.#', '#.###.#.#', '#T#####.#', '#PK.....#', '#########'],
    monsters: [], doorsOpen: false,
    solution: [R, ...many(R, 5), ...many(U, 6)],
  },
  {
    id: 'level-4', name: '第四关：双重追击',
    tiles: ['#########', '#W#....E#', '###G###G#', '#R#...#.#', '##.##.#.#', '#.###.#.#', '#T#####.#', '#PK.....#', '#########'],
    monsters: [], doorsOpen: false,
    solution: [R, ...many(R, 5), ...many(U, 6)],
  },
  {
    id: 'level-5', name: '第五关：陷阱与机关',
    tiles: ['#########', '#W#....E#', '###.###G#', '#S#...#.#', '##.##.#.#', '#T###.#.#', '#T#####.#', '#PK.....#', '#########'],
    monsters: [], doorsOpen: false,
    solution: [R, ...many(R, 5), ...many(U, 6)],
  },
  {
    id: 'level-6', name: '第六关：金字塔深处',
    tiles: ['#########', '#W#R#..E#', '###.###G#', '#S#...#.#', '##.##.#.#', '#T###.#.#', '#T#####.#', '#PK.....#', '#########'],
    monsters: [], doorsOpen: false,
    solution: [R, ...many(R, 5), ...many(U, 6)],
  },
];
```

关卡元素由地图符号自动解析：`W` 白木乃伊、`R` 红木乃伊、`S` 蝎子、`#` 墙、`T` 陷阱、`K` 钥匙、`G` 闸门、`E` 出口、`P` 玩家。

- [ ] **Step 4: 验证并修正地图**

Run: `node --test test/levels.test.js`

Expected: PASS。若路线被挡、被怪物抓住或提前失败，修正对应关卡的墙壁或预设方向，并重新运行同一条命令；不得删除失败测试。

- [ ] **Step 5: 运行全部测试并提交**

Run: `npm test`

Expected: PASS。

```bash
git add src/engine/levels.js test/levels.test.js
git commit -m "feat: add six progressive levels"
```

---

### Task 5: System One 服务端代理

**Files:**
- Modify: `server/jev.js`
- Modify: `server/app.js`
- Test: `test/server.test.js`

**Interfaces:**
- Produces: `buildSystemOnePayload(snapshot)`、`parseSystemOneResponse(response)`、`createJevHandler(options)`。
- `createJevHandler` 读取 `OMNILABS_API_KEY`，默认基址为 `https://omnilabs.vibeadmin.cn`，默认超时 20 秒。

- [ ] **Step 1: 追加失败测试**

```javascript
// test/server.test.js 追加
import { buildSystemOnePayload, parseSystemOneResponse, createJevHandler } from '../server/jev.js';

test('请求包含 Yes/No 与四方向问题', () => {
  const payload = buildSystemOnePayload({ levelId: 'level-1', tiles: [['wall']], player: { x: 1, y: 1 }, monsters: [], doorsOpen: false, turn: 0 });
  assert.equal(payload.model, 'jev-latest');
  assert.equal(payload.questions.toward_exit.type, 'noul');
  assert.deepEqual(Object.keys(payload.questions.next_move.criteria), ['up', 'down', 'left', 'right']);
});

test('解析合法方向', () => {
  const result = parseSystemOneResponse({
    answers: { toward_exit: { type: 'noul', noul: 0.18 }, next_move: { type: 'choice', choice: 'down', confidence: 0.91, probabilities: { up: 0.04, down: 0.91, left: 0.03, right: 0.02 } } },
    usage: { input_tokens: 200, output_tokens: 24 },
  });
  assert.equal(result.direction, 'down');
  assert.equal(result.yesProbability, 0.18);
  assert.equal(result.usage.input_tokens, 200);
});

test('代理不会向客户端泄漏 Key', async () => {
  const fetcher = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    return new Response(JSON.stringify({ answers: { toward_exit: { type: 'noul', noul: 0.2 }, next_move: { type: 'choice', choice: 'left', confidence: 0.8, probabilities: { up: 0.1, down: 0.1, left: 0.7, right: 0.1 } } }, usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const server = createApp({ jevHandler: createJevHandler({ fetcher, apiKey: 'test-key' }) }).listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/jev/decide`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ levelId: 'level-1' }) });
    const body = await response.json();
    assert.equal(body.direction, 'left');
    assert.equal(JSON.stringify(body).includes('test-key'), false);
  } finally { server.close(); }
});
```

- [ ] **Step 2: 确认失败**

Run: `node --test test/server.test.js`

Expected: FAIL，当前 `jev.js` 仍返回 503，缺少系统判断实现。

- [ ] **Step 3: 实现代理**

```javascript
// server/jev.js
const BASE_URL = 'https://omnilabs.vibeadmin.cn';

export function buildSystemOnePayload(snapshot) {
  return {
    model: 'jev-latest',
    state: { game: '木乃伊迷宫', objective: '避开怪物并到达出口', snapshot },
    questions: {
      toward_exit: { type: 'noul', instructions: '本回合优先靠近出口是最佳策略。', criteria: { true: '靠近出口能增加安全通关概率。', false: '应先绕路或处理怪物位置。' } },
      next_move: { type: 'choice', instructions: '探险家下一步应向上、下、左、右中的哪个方向移动一格，才能最大化通关概率？', criteria: { up: '向上移动一格并触发怪物回合。', down: '向下移动一格并触发怪物回合。', left: '向左移动一格并触发怪物回合。', right: '向右移动一格并触发怪物回合。' } },
    },
  };
}

export function parseSystemOneResponse(response) {
  const toward = response?.answers?.toward_exit;
  const move = response?.answers?.next_move;
  if (toward?.type !== 'noul' || typeof toward.noul !== 'number') throw new Error('INVALID_TOWARD_EXIT');
  if (move?.type !== 'choice' || !['up', 'down', 'left', 'right'].includes(move.choice)) throw new Error('INVALID_DIRECTION');
  return { direction: move.choice, confidence: move.confidence, probabilities: move.probabilities, yesProbability: toward.noul, noProbability: 1 - toward.noul, usage: response.usage ?? { input_tokens: 0, output_tokens: 0 } };
}

export function createJevHandler({ fetcher = fetch, apiKey = process.env.OMNILABS_API_KEY, baseUrl = process.env.OMNILABS_BASE_URL || BASE_URL, timeoutMs = 20_000 } = {}) {
  return async (request, response) => {
    if (!apiKey) { response.status(503).json({ error: 'JEV_NOT_CONFIGURED', message: '缺少 OMNILABS_API_KEY' }); return; }
    const startedAt = performance.now();
    try {
      const upstream = await fetcher(`${baseUrl}/v1/systemone`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(buildSystemOnePayload(request.body)), signal: AbortSignal.timeout(timeoutMs) });
      const text = await upstream.text();
      if (!upstream.ok) { response.status(upstream.status).json({ error: 'UPSTREAM_ERROR', message: text.slice(0, 500) }); return; }
      response.json({ ...parseSystemOneResponse(JSON.parse(text)), latencyMs: Math.round(performance.now() - startedAt) });
    } catch (error) {
      const timeout = error.name === 'TimeoutError';
      response.status(timeout ? 504 : 502).json({ error: timeout ? 'JEV_TIMEOUT' : 'JEV_REQUEST_FAILED', message: error.message });
    }
  };
}
```

- [ ] **Step 4: 验证并提交**

Run: `node --test test/server.test.js`

Expected: PASS，响应正文和测试输出都不包含 `test-key`。

```bash
git add server/jev.js server/app.js test/server.test.js
git commit -m "feat: proxy Jev system one decisions"
```

---

### Task 6: 页面骨架与 Canvas 渲染

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `src/ui/renderer.js`
- Create: `src/main.js`

**Interfaces:**
- Produces: `renderGame(canvas, state)`、`animateEvents(canvas, state, events, durationMs = 180)`。
- 页面包含 `#game-canvas`、`#ai-button`、`#restart-button`、`#decision-card`、`#decision-history`、`#export-button`。

- [ ] **Step 1: 创建页面结构**

```html
<!-- public/index.html -->
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>木乃伊迷宫 · Jev 实验室</title>
  <link rel="stylesheet" href="/public/styles.css">
</head>
<body>
  <main class="app-shell">
    <header class="topbar">
      <div><h1>木乃伊迷宫</h1><p id="level-name">第一关</p></div>
      <div><button id="restart-button">重开本关</button><button id="ai-button">AI 自动</button></div>
    </header>
    <section class="game-column">
      <canvas id="game-canvas" width="720" height="720"></canvas>
      <p id="game-message">使用方向键移动探险家</p>
    </section>
    <aside class="metrics-panel">
      <section class="status-grid">
        <div><span>状态</span><strong id="ai-status">手动</strong></div>
        <div><span>回合</span><strong id="turn-count">0</strong></div>
        <div><span>用时</span><strong id="elapsed-time">00:00</strong></div>
      </section>
      <section id="decision-card" class="decision-card">
        <p>Jev</p><h2>等待判断</h2>
        <div id="yes-no-row"></div><h3>最佳动作</h3>
        <div id="direction-probabilities"></div>
        <p id="final-action">尚未执行动作</p>
      </section>
      <section class="summary-grid">
        <div><span>平均置信度</span><strong id="average-confidence">--</strong></div>
        <div><span>平均耗时</span><strong id="average-latency">--</strong></div>
        <div><span>Token</span><strong id="total-tokens">0</strong></div>
      </section>
      <section><div class="section-heading"><h2>本关记录</h2><button id="export-button">导出 JSON</button></div><ol id="decision-history"></ol></section>
    </aside>
  </main>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 添加响应式样式**

```css
/* public/styles.css */
:root { color-scheme: dark; font-family: "Microsoft YaHei", system-ui, sans-serif; background: #120f0b; color: #f8e7bf; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 1180px; background: radial-gradient(circle at top, #3c2a17, #100d09 55%); }
button { border: 1px solid #b78a3d; border-radius: 8px; padding: 10px 16px; background: #2b2117; color: inherit; cursor: pointer; }
.app-shell { display: grid; grid-template-columns: minmax(680px, 1fr) 380px; grid-template-rows: auto 1fr; gap: 18px; min-height: 100vh; padding: 20px; }
.topbar { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; }
.game-column { display: grid; place-items: center; }
canvas { width: min(72vh, 720px); aspect-ratio: 1; border: 8px solid #6f5027; border-radius: 12px; box-shadow: 0 20px 60px #000b; }
.metrics-panel { display: flex; flex-direction: column; gap: 14px; }
.status-grid, .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.status-grid div, .summary-grid div, .decision-card { border: 1px solid #654820; border-radius: 10px; background: #1d1812dd; padding: 12px; }
.status-grid span, .summary-grid span { display: block; color: #bba77e; font-size: 12px; }
#yes-no-row, #direction-probabilities { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.probability-item { display: flex; justify-content: space-between; padding: 7px 9px; border-radius: 6px; background: #332617; }
.probability-item.best { outline: 2px solid #e4b84f; }
.section-heading { display: flex; justify-content: space-between; align-items: center; }
#decision-history { padding-left: 24px; max-height: 260px; overflow: auto; }
```

- [ ] **Step 3: 实现 Canvas 渲染与动画**

```javascript
// src/ui/renderer.js
import { MONSTER_TYPE, TILE } from '../engine/constants.js';
const COLORS = { floor: '#2d2115', wall: '#80602f', exit: '#2d7d55', trap: '#b63c2f', key: '#d9b44a', gate: '#6f3c1f' };

function drawEntity(context, item, state, size, type = item.type) {
  const cell = size / state.width;
  context.beginPath();
  context.arc((item.x + 0.5) * cell, (item.y + 0.5) * cell, cell * 0.32, 0, Math.PI * 2);
  context.fillStyle = type === MONSTER_TYPE.WHITE ? '#eee4ca' : type === MONSTER_TYPE.RED ? '#c84936' : type === MONSTER_TYPE.SCORPION ? '#6f8f3a' : '#58b7d1';
  context.fill(); context.strokeStyle = '#100b07'; context.lineWidth = Math.max(2, cell * 0.08); context.stroke();
}

export function renderGame(canvas, state) {
  const context = canvas.getContext('2d');
  const size = Math.min(canvas.width, canvas.height);
  const cell = size / state.width;
  context.clearRect(0, 0, canvas.width, canvas.height);
  state.tiles.forEach((row, y) => row.forEach((tile, x) => {
    context.fillStyle = tile === TILE.GATE && state.doorsOpen ? '#597143' : COLORS[tile] || COLORS.floor;
    context.fillRect(x * cell, y * cell, cell, cell); context.strokeStyle = '#160f09'; context.strokeRect(x * cell, y * cell, cell, cell);
  }));
  state.monsters.forEach((monster) => drawEntity(context, monster, state, size));
  drawEntity(context, state.player, state, size, 'player');
}

export async function animateEvents(canvas, state, events, durationMs = 180) {
  for (const event of events) {
    renderGame(canvas, state);
    if (event.type === 'move') await new Promise((resolve) => setTimeout(resolve, durationMs));
  }
  renderGame(canvas, state);
}
```

- [ ] **Step 4: 接入基础方向键**

```javascript
// src/main.js
import { createGame, stepGame } from './engine/engine.js';
import { LEVELS } from './engine/levels.js';
import { renderGame, animateEvents } from './ui/renderer.js';
const canvas = document.querySelector('#game-canvas');
let state = createGame(LEVELS[0]);
renderGame(canvas, state);
document.addEventListener('keydown', async (event) => {
  const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
  if (!direction) return;
  const result = stepGame(state, direction);
  state = result.state;
  await animateEvents(canvas, state, result.events);
});
```

- [ ] **Step 5: 验证并提交**

Run: `npm start`

Expected: 页面显示第一关；按方向键能改变状态且墙体、出口、木乃伊和玩家清晰可辨。

```bash
git add public/index.html public/styles.css src/ui/renderer.js src/main.js
git commit -m "feat: render playable maze"
```

---

### Task 7: 顺序动画与完整人工关卡推进

**Files:**
- Modify: `src/ui/renderer.js`
- Modify: `src/main.js`
- Modify: `src/engine/engine.js`
- Test: `test/engine-mechanics.test.js`

**Interfaces:**
- Consumes: `stepGame` 返回的 `events`。
- Produces: 玩家、白木乃伊、红木乃伊、蝎子按顺序播放的补间动画，以及通关自动下一关和失败暂停。

- [ ] **Step 1: 追加事件顺序测试**

```javascript
// test/engine-mechanics.test.js 追加
test('事件顺序从玩家开始', () => {
  const level = { id: 'o', name: 'o', tiles: ['##########', '#WRS..P..#', '#.......E#', '##########'], monsters: [], doorsOpen: false };
  const result = stepGame(createGame(level), 'right');
  assert.equal(result.events.find((event) => event.type === 'move').entity, 'player');
});
```

- [ ] **Step 2: 运行测试并确认失败或作为回归保护**

Run: `node --test test/engine-mechanics.test.js --test-name-pattern="事件顺序"`

Expected: 排序正确时 PASS；否则 FAIL，先修正 `moveAllMonsters` 的稳定排序。

- [ ] **Step 3: 实现位置补间**

```javascript
// src/ui/renderer.js，追加
function interpolate(from, to, progress) {
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
}

async function animateMove(canvas, state, event, durationMs) {
  const startedAt = performance.now();
  await new Promise((resolve) => {
    function frame(now) {
      const progress = Math.min(1, (now - startedAt) / Math.max(1, durationMs));
      const display = structuredClone(state);
      if (event.entity === 'player') display.player = interpolate(event.from, event.to, progress);
      else {
        const monster = display.monsters.find((item) => item.id === event.entityId);
        if (monster) Object.assign(monster, interpolate(event.from, event.to, progress));
      }
      renderGame(canvas, display);
      progress < 1 ? requestAnimationFrame(frame) : resolve();
    }
    requestAnimationFrame(frame);
  });
}

export async function animateEvents(canvas, state, events, durationMs = 180) {
  for (const event of events) if (event.type === 'move') await animateMove(canvas, state, event, durationMs);
  renderGame(canvas, state);
}
```

- [ ] **Step 4: 完成人工玩法状态机**

```javascript
// src/main.js，替换 Task 6 的临时入口
import { createGame, stepGame } from './engine/engine.js';
import { LEVELS } from './engine/levels.js';
import { renderGame, animateEvents } from './ui/renderer.js';

const canvas = document.querySelector('#game-canvas');
const message = document.querySelector('#game-message');
const levelName = document.querySelector('#level-name');
const turnCount = document.querySelector('#turn-count');
let levelIndex = 0;
let state = createGame(LEVELS[levelIndex]);
let busy = false;

function showState() {
  levelName.textContent = `${state.levelName} · ${levelIndex + 1}/${LEVELS.length}`;
  turnCount.textContent = String(state.turn);
  renderGame(canvas, state);
}

function loadLevel(index) {
  levelIndex = index;
  state = createGame(LEVELS[levelIndex]);
  message.textContent = '使用方向键移动探险家';
  showState();
}

let applyDirection = async function applyDirection(direction) {
  if (busy || state.status !== 'playing') return false;
  busy = true;
  const result = stepGame(state, direction);
  state = result.state;
  await animateEvents(canvas, state, result.events);
  showState();
  if (state.status === 'won') {
    message.textContent = '过关成功，正在进入下一关';
    if (levelIndex < LEVELS.length - 1) setTimeout(() => loadLevel(levelIndex + 1), 1200);
    else message.textContent = '六关全部完成';
  } else if (state.status === 'lost') {
    message.textContent = state.lastEvents.at(-1)?.reason === 'trap' ? '踩中陷阱，已失败' : '被怪物抓住，已失败';
  }
  busy = false;
  return result.accepted;
};

document.querySelector('#restart-button').addEventListener('click', () => loadLevel(levelIndex));
document.addEventListener('keydown', (event) => {
  const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
  if (direction) applyDirection(direction);
});
loadLevel(0);
```

- [ ] **Step 5: 验证并提交**

Run: `npm test`

Expected: PASS。

Run: `npm start`

Expected: 每次行动按顺序看到玩家和怪物移动；通关 1.2 秒后自动进入下一关；失败时保留棋盘并提示原因。

```bash
git add src/ui/renderer.js src/main.js src/engine/engine.js test/engine-mechanics.test.js
git commit -m "feat: animate turns and level progression"
```

---

### Task 8: 指标、Jev 客户端与 AI 托管

**Files:**
- Create: `src/engine/snapshot.js`
- Create: `src/ui/jev-client.js`
- Create: `src/ui/metrics.js`
- Modify: `src/main.js`
- Test: `test/metrics.test.js`

**Interfaces:**
- Produces: `createSnapshot(state)`、`requestJevDecision(snapshot)`、`createMetrics()`、`recordDecision(metrics, decision)`、`recordLevelResult(metrics, result)`、`summarizeMetrics(metrics)`。
- `DecisionResult` 包含 `direction`、`confidence`、`probabilities`、`yesProbability`、`noProbability`、`latencyMs`、`usage`。

- [ ] **Step 1: 写指标测试**

```javascript
// test/metrics.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetrics, recordDecision, summarizeMetrics } from '../src/ui/metrics.js';

test('指标正确计算平均置信度、耗时和 token', () => {
  const metrics = createMetrics();
  recordDecision(metrics, { direction: 'up', confidence: 0.8, latencyMs: 1000, usage: { input_tokens: 20, output_tokens: 5 } });
  recordDecision(metrics, { direction: 'down', confidence: 0.6, latencyMs: 3000, usage: { input_tokens: 30, output_tokens: 7 } });
  const summary = summarizeMetrics(metrics);
  assert.equal(summary.averageConfidence, 0.7);
  assert.equal(summary.averageLatencyMs, 2000);
  assert.equal(summary.totalTokens, 62);
});
```

- [ ] **Step 2: 确认失败**

Run: `node --test test/metrics.test.js`

Expected: FAIL，缺少 `metrics.js`。

- [ ] **Step 3: 实现快照、客户端和指标**

```javascript
// src/engine/snapshot.js
export function createSnapshot(state) {
  return { levelId: state.levelId, levelName: state.levelName, width: state.width, height: state.height, tiles: state.tiles, player: { ...state.player }, monsters: state.monsters.map((monster) => ({ ...monster })), doorsOpen: state.doorsOpen, turn: state.turn };
}
```

```javascript
// src/ui/jev-client.js
export async function requestJevDecision(snapshot) {
  const response = await fetch('/api/jev/decide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.message || 'Jev 请求失败'); error.code = body.error; throw error; }
  return body;
}
```

```javascript
// src/ui/metrics.js
export function createMetrics() {
  return { decisions: [], levels: [], sessionStartedAt: new Date().toISOString() };
}

export function recordDecision(metrics, decision) {
  metrics.decisions.push({ ...decision, recordedAt: new Date().toISOString() });
}

export function recordLevelResult(metrics, result) {
  metrics.levels.push({ ...result, recordedAt: new Date().toISOString() });
}

export function summarizeMetrics(metrics) {
  const count = metrics.decisions.length;
  const totalConfidence = metrics.decisions.reduce((sum, item) => sum + Number(item.confidence || 0), 0);
  const totalLatency = metrics.decisions.reduce((sum, item) => sum + Number(item.latencyMs || 0), 0);
  const totalTokens = metrics.decisions.reduce((sum, item) => sum + Number(item.usage?.input_tokens || 0) + Number(item.usage?.output_tokens || 0), 0);
  return { decisionCount: count, averageConfidence: count ? totalConfidence / count : null, averageLatencyMs: count ? Math.round(totalLatency / count) : null, totalTokens };
}
```

- [ ] **Step 4: 接入判断卡和 AI 回合**

在 `src/main.js` 中导入 `createSnapshot`、`requestJevDecision`、`createMetrics`、`recordDecision`、`summarizeMetrics`，添加：

```javascript
const metrics = createMetrics();
const aiButton = document.querySelector('#ai-button');
const aiStatus = document.querySelector('#ai-status');
const history = document.querySelector('#decision-history');
let aiEnabled = false;
let aiRunToken = 0;

const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;

function renderDecision(decision) {
  document.querySelector('#yes-no-row').innerHTML = `<div class="probability-item"><span>Yes</span><strong>${percent(decision.yesProbability)}</strong></div><div class="probability-item"><span>No</span><strong>${percent(decision.noProbability)}</strong></div>`;
  document.querySelector('#direction-probabilities').innerHTML = ['up', 'down', 'left', 'right'].map((direction) => `<div class="probability-item ${direction === decision.direction ? 'best' : ''}"><span>${direction}</span><strong>${percent(decision.probabilities?.[direction])}</strong></div>`).join('');
  document.querySelector('#final-action').textContent = `最终执行：${decision.direction}（${percent(decision.confidence)}）`;
  const summary = summarizeMetrics(metrics);
  document.querySelector('#average-confidence').textContent = summary.averageConfidence === null ? '--' : percent(summary.averageConfidence);
  document.querySelector('#average-latency').textContent = summary.averageLatencyMs === null ? '--' : `${summary.averageLatencyMs} ms`;
  document.querySelector('#total-tokens').textContent = String(summary.totalTokens);
}

async function runAiTurn() {
  const runToken = aiRunToken;
  if (!aiEnabled || runToken !== aiRunToken || busy || state.status !== 'playing') return;
  aiStatus.textContent = 'Jev 思考中';
  try {
    const decision = await requestJevDecision(createSnapshot(state));
    if (!aiEnabled || runToken !== aiRunToken) return;
    renderDecision(decision);
    aiStatus.textContent = '执行 Jev 方向';
    const accepted = await applyDirection(decision.direction, { fromAi: true });
    if (!accepted) throw new Error('Jev 选择了不可通行方向，AI 已暂停');
    decision.result = state.status === 'won' ? '通关' : state.status === 'lost' ? '失败' : '成功';
    recordDecision(metrics, decision);
    const historyItem = document.createElement('li');
    historyItem.textContent = `第 ${state.turn} 回合 · ${decision.direction} · Yes ${percent(decision.yesProbability)} / No ${percent(decision.noProbability)} · 上 ${percent(decision.probabilities?.up)} 下 ${percent(decision.probabilities?.down)} 左 ${percent(decision.probabilities?.left)} 右 ${percent(decision.probabilities?.right)} · 置信度 ${percent(decision.confidence)} · ${decision.latencyMs} ms · ${(decision.usage?.input_tokens || 0) + (decision.usage?.output_tokens || 0)} token · ${decision.result}`;
    history.prepend(historyItem);
  } catch (error) {
    aiEnabled = false;
    aiButton.textContent = 'AI 自动';
    aiStatus.textContent = '已暂停';
    message.textContent = error.message;
  } finally {
    if (aiEnabled && runToken === aiRunToken && state.status === 'playing') queueMicrotask(runAiTurn);
  }
}

aiButton.addEventListener('click', async () => {
  aiEnabled = !aiEnabled;
  aiRunToken += 1;
  aiButton.textContent = aiEnabled ? '停止 AI' : 'AI 自动';
  aiStatus.textContent = aiEnabled ? '准备判断' : '手动';
  if (aiEnabled) await runAiTurn();
});
```

同时把 `applyDirection` 改为接受 AI 标记，并让键盘只在手动模式调用：

```javascript
applyDirection = async function applyDirection(direction, { fromAi = false } = {}) {
  if (aiEnabled && !fromAi) return false;
  if (busy || state.status !== 'playing') return false;
  busy = true;
  // 保留 Task 7 中的回合、动画、胜负和关卡推进代码
  busy = false;
  return result.accepted;
};

document.addEventListener('keydown', (event) => {
  const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
  if (direction && !aiEnabled) applyDirection(direction);
});
```

- [ ] **Step 5: 验证并提交**

Run: `npm test`

Expected: PASS。

Run: `npm start`

Expected: 未配置 Key 时显示明确提示；配置 Key 后 AI 每回合调用一次 Jev，判断卡展示 Yes/No、四方向概率、最终动作、置信度、耗时和 token。

```bash
git add src/engine/snapshot.js src/ui/jev-client.js src/ui/metrics.js src/main.js test/metrics.test.js
git commit -m "feat: add Jev controlled turns and metrics"
```

---

### Task 9: 历史导出、异常状态与运行文档

**Files:**
- Modify: `src/ui/metrics.js`
- Modify: `src/main.js`
- Create: `README.md`
- Test: `test/metrics.test.js`

**Interfaces:**
- Produces: `createExport(metrics)`、浏览器下载 JSON、完整运行说明和错误状态。

- [ ] **Step 1: 写导出测试**

```javascript
// test/metrics.test.js 追加
import { createExport } from '../src/ui/metrics.js';

test('导出包含模型、汇总、关卡和决策', () => {
  const metrics = createMetrics();
  recordDecision(metrics, { direction: 'right', confidence: 0.9, latencyMs: 1200, usage: { input_tokens: 10, output_tokens: 2 } });
  const exported = createExport(metrics);
  assert.equal(exported.model, 'jev-latest');
  assert.equal(exported.decisions.length, 1);
  assert.ok(exported.exportedAt);
});
```

- [ ] **Step 2: 确认失败**

Run: `node --test test/metrics.test.js --test-name-pattern="导出"`

Expected: FAIL，`createExport is not a function`。

- [ ] **Step 3: 实现导出和错误文案**

```javascript
// src/ui/metrics.js，追加
export function createExport(metrics) {
  return { model: 'jev-latest', exportedAt: new Date().toISOString(), summary: summarizeMetrics(metrics), decisions: structuredClone(metrics.decisions), levels: structuredClone(metrics.levels) };
}
```

在 `src/main.js` 中导入 `createExport` 和 `recordLevelResult`，并添加：

```javascript
function downloadMetrics() {
  const blob = new Blob([JSON.stringify(createExport(metrics), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mummy-maze-jev-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

document.querySelector('#export-button').addEventListener('click', downloadMetrics);
```

通关和失败结算时分别调用：

```javascript
recordLevelResult(metrics, { levelId: state.levelId, result: 'won', turns: state.turn });
recordLevelResult(metrics, { levelId: state.levelId, result: 'lost', reason: state.lastEvents.at(-1)?.reason, turns: state.turn });
```

错误文案映射固定为：`401` 显示“API Key 无效”，`422` 显示“Jev 请求校验失败”，`429` 显示“请求过于频繁”，`504` 显示“Jev 响应超时”。错误后关闭 AI、保留历史并等待用户手动重试。

- [ ] **Step 4: 编写 README**

````markdown
# 木乃伊迷宫 · Jev 实验室

## 启动

1. 安装 Node.js 20 或更高版本。
2. 执行 `npm install`。
3. 在项目根目录创建 `.env`：

```text
OMNILABS_API_KEY=你的本地测试密钥
OMNILABS_BASE_URL=https://omnilabs.vibeadmin.cn
```

4. 执行 `npm start`。
5. 浏览器打开 `http://127.0.0.1:4173`。

## 操作

- 方向键：移动一格并触发怪物回合。
- `AI 自动`：由 Jev 逐回合选择方向。
- `重开本关`：恢复当前关初始状态。
- `导出 JSON`：导出完整 Jev 判断和响应指标。

## 安全

真实 API Key 只保存在本地 `.env`，该文件已被 Git 忽略。不要把 `.env` 发送或提交到任何仓库。
````

- [ ] **Step 5: 完整验收**

Run: `npm test`

Expected: 全部测试通过。

Run: `npm start`

Expected: 逐项确认六关键盘可玩；Jev 每回合只返回一个方向；右侧显示 Yes/No、四方向概率、最终方向、置信度、耗时和 token；低置信度仍执行 Jev 选择；网络错误暂停且不本地兜底；通关自动下一关；第六关结束显示汇总；JSON 可导出；源码、网络响应和导出文件不包含 API Key。

- [ ] **Step 6: 提交**

```bash
git add README.md src/ui/metrics.js src/main.js test/metrics.test.js
git commit -m "feat: add result export and usage guide"
```

---

## 最终检查清单

- [ ] `npm test` 全部通过。
- [ ] `npm start` 能启动本地网页。
- [ ] 真实 API Key 只存在于未提交的 `.env`。
- [ ] 六关均可通关并自动推进。
- [ ] Jev 四方向概率、Yes/No、置信度、耗时和 token 显示正确。
- [ ] 请求失败后会暂停并等待用户重试。
- [ ] 导出 JSON 与会话记录一致。
- [ ] 代码注释全部使用中文。
---

## 执行补充：关卡合理性修订

原 Task 4 中的早期示例地图用于先验证规则，怪物被墙体隔离，无法形成真实追击压力。实施过程中已用 `scripts/design-levels.mjs` 搜索并验证新的正式关卡，要求：

- 每只怪物都必须实际移动并参与追击。
- 玩家路线必须至少一次接近怪物到 3 格以内。
- 第 3 至第 6 关必须实际踩到钥匙并穿过闸门。
- 第六关控制为 9×9、20 步左右，避免等待 Jev 的时间过长。

正式关卡以 `src/engine/levels.js` 为准，并由 `test/levels.test.js` 回放验证。
