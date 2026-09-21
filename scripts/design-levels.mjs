import { GAME_STATUS, TILE } from '../src/engine/constants.js';
import { createGame, stepGame } from '../src/engine/engine.js';

const DIRS = ['up', 'down', 'left', 'right'];

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let temp = value;
    temp = Math.imul(temp ^ (temp >>> 15), temp | 1);
    temp ^= temp + Math.imul(temp ^ (temp >>> 7), temp | 61);
    return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function openCells(width, height) {
  const cells = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) cells.push({ x, y });
  }
  return cells;
}

function makeMap(config, random) {
  const { width, height, wallChance } = config;
  const grid = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => (
    x === 0 || y === 0 || x === width - 1 || y === height - 1 ? '#' : random() < wallChance ? '#' : '.'
  )));
  const cells = shuffle(openCells(width, height).filter(({ x, y }) => grid[y][x] === '.'), random);
  if (cells.length < 20) return null;

  const player = cells[0];
  const farCells = cells.filter((cell) => Math.abs(cell.x - player.x) + Math.abs(cell.y - player.y) >= width - 2);
  if (!farCells.length) return null;
  const exit = farCells[Math.floor(random() * farCells.length)];
  const used = new Set([`${player.x},${player.y}`, `${exit.x},${exit.y}`]);
  const choose = () => {
    const options = cells.filter((cell) => !used.has(`${cell.x},${cell.y}`));
    if (!options.length) return null;
    const cell = options[Math.floor(random() * options.length)];
    used.add(`${cell.x},${cell.y}`);
    return cell;
  };

  const monsters = config.monsters || [];
  const specials = [];
  for (const type of monsters) {
    const cell = choose();
    if (!cell) return null;
    specials.push({ symbol: type, ...cell });
  }
  for (let index = 0; index < (config.traps || 0); index += 1) {
    const cell = choose();
    if (!cell) return null;
    specials.push({ symbol: 'T', ...cell });
  }
  if ((config.keys || 0) > 0) {
    for (let index = 0; index < config.keys; index += 1) {
      const cell = choose();
      if (!cell) return null;
      specials.push({ symbol: 'K', ...cell });
    }
  }
  if ((config.gates || 0) > 0) {
    for (let index = 0; index < config.gates; index += 1) {
      const cell = choose();
      if (!cell) return null;
      specials.push({ symbol: 'G', ...cell });
    }
  }

  grid[player.y][player.x] = 'P';
  grid[exit.y][exit.x] = 'E';
  for (const item of specials) grid[item.y][item.x] = item.symbol;
  return { tiles: grid.map((row) => row.join('')), player, exit, monsters: specials.filter((item) => 'WRS'.includes(item.symbol)) };
}

function keyOf(state) {
  return [
    state.player.x,
    state.player.y,
    state.doorsOpen ? 1 : 0,
    ...state.monsters.map((monster) => `${monster.type}:${monster.x}:${monster.y}`),
  ].join('|');
}

function solve(level, maxDepth = 60) {
  const initial = createGame(level);
  const queue = [{ state: initial, path: [], monsterMoves: 0, minThreat: 99, visitedKey: false, crossedGate: false }];
  const visited = new Set([keyOf(initial)]);
  let cursor = 0;

  while (cursor < queue.length) {
    const node = queue[cursor];
    cursor += 1;
    if (node.path.length >= maxDepth) continue;

    for (const direction of DIRS) {
      const result = stepGame(node.state, direction);
      if (!result.accepted) continue;
      const nextKey = keyOf(result.state);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);

      const moveCount = result.events.filter((event) => event.type === 'move' && event.entity !== 'player').length;
      const threat = Math.min(...result.state.monsters.map((monster) => (
        Math.abs(monster.x - result.state.player.x) + Math.abs(monster.y - result.state.player.y)
      )));
      const destination = result.state.tiles[result.state.player.y][result.state.player.x];
      const next = {
        state: result.state,
        path: [...node.path, direction],
        monsterMoves: node.monsterMoves + moveCount,
        minThreat: Math.min(node.minThreat, threat),
        visitedKey: node.visitedKey || destination === TILE.KEY,
        crossedGate: node.crossedGate || destination === TILE.GATE,
      };

      if (result.state.status === GAME_STATUS.WON) return next;
      if (result.state.status !== GAME_STATUS.PLAYING) continue;
      queue.push(next);
      if (queue.length > 250000) return null;
    }
  }
  return null;
}

function isUsable(candidate, result, config) {
  if (!result || result.path.length < config.minPath) return false;
  if (!candidate.monsters.length || result.monsterMoves < config.minMonsterMoves) return false;
  if (result.minThreat > config.maxThreat) return false;
  if (config.keys > 0 && !result.visitedKey) return false;
  if (config.gates > 0 && !result.crossedGate) return false;
  const wallCount = candidate.tiles.join('').split('').filter((symbol) => symbol === '#').length;
  if (wallCount < config.minWalls) return false;
  return true;
}

const configs = [
  { name: 'level-1', width: 7, height: 7, wallChance: 0.2, monsters: ['W'], traps: 0, keys: 0, gates: 0, minPath: 8, minMonsterMoves: 5, minThreat: 99, maxThreat: 3, minWalls: 12 },
  { name: 'level-2', width: 7, height: 7, wallChance: 0.23, monsters: ['R'], traps: 1, keys: 0, gates: 0, minPath: 10, minMonsterMoves: 10, minThreat: 99, maxThreat: 4, minWalls: 14 },
  { name: 'level-3', width: 9, height: 9, wallChance: 0.2, monsters: ['S'], traps: 1, keys: 1, gates: 1, minPath: 12, minMonsterMoves: 8, minThreat: 99, maxThreat: 4, minWalls: 20 },
  { name: 'level-4', width: 9, height: 9, wallChance: 0.22, monsters: ['W', 'R'], traps: 1, keys: 1, gates: 1, minPath: 14, minMonsterMoves: 20, minThreat: 99, maxThreat: 4, minWalls: 22 },
  { name: 'level-5', width: 9, height: 9, wallChance: 0.24, monsters: ['W', 'R', 'S'], traps: 2, keys: 1, gates: 1, minPath: 16, minMonsterMoves: 25, minThreat: 99, maxThreat: 5, minWalls: 24 },
  { name: 'level-6', width: 9, height: 9, wallChance: 0.22, monsters: ['W', 'W', 'S'], traps: 2, keys: 1, gates: 1, minPath: 15, minMonsterMoves: 15, minThreat: 99, maxThreat: 5, minWalls: 22, maxDepth: 32 },
];

const requestedLevel = process.argv[2];
for (const config of configs.filter((item) => !requestedLevel || item.name === requestedLevel)) {
  let best = null;
  for (let seed = 1; seed <= 12000; seed += 1) {
    const random = rng(seed * 7919 + config.name.length * 104729);
    const candidate = makeMap(config, random);
    if (!candidate) continue;
    const result = solve({ id: config.name, name: config.name, ...candidate, doorsOpen: false }, config.maxDepth || 70);
    if (!isUsable(candidate, result, config)) continue;
    const score = result.path.length * 3 + result.monsterMoves + (8 - Math.min(result.minThreat, 8)) * 3;
    if (!best || score < best.score) best = { score, candidate, result, seed };
  }
  console.log(JSON.stringify({ config, best }, null, 2));
}
