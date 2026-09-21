import { DIRECTIONS, GAME_STATUS, MONSTER_TYPE, TILE } from './constants.js';
import { tileAt } from './state.js';

function towardHorizontal(value) {
  if (value < 0) return 'left';
  if (value > 0) return 'right';
  return null;
}

function towardVertical(value) {
  if (value < 0) return 'up';
  if (value > 0) return 'down';
  return null;
}

function samePosition(left, right) {
  return left.x === right.x && left.y === right.y;
}

function occupiedByMonster(state, monsterId, x, y) {
  return state.monsters.some((other) => other.id !== monsterId && other.x === x && other.y === y);
}

function canMonsterEnter(state, monster, x, y) {
  const tile = tileAt(state, x, y);
  if (tile === TILE.WALL) return false;
  if (tile === TILE.GATE && !state.doorsOpen) return false;
  return !occupiedByMonster(state, monster.id, x, y);
}

export function chooseMonsterDirection(state, monster) {
  const horizontal = towardHorizontal(state.player.x - monster.x);
  const vertical = towardVertical(state.player.y - monster.y);
  const preferences = monster.type === MONSTER_TYPE.RED
    ? [vertical, horizontal]
    : monster.type === MONSTER_TYPE.SCORPION
      ? [horizontal, vertical]
      : [horizontal, vertical];

  for (const direction of preferences) {
    if (!direction) continue;
    const vector = DIRECTIONS[direction];
    if (canMonsterEnter(state, monster, monster.x + vector.x, monster.y + vector.y)) {
      return direction;
    }
  }
  return null;
}

function moveMonsterOnce(state, monster, events) {
  const direction = chooseMonsterDirection(state, monster);
  if (!direction) return false;

  const vector = DIRECTIONS[direction];
  const from = { x: monster.x, y: monster.y };
  const to = { x: from.x + vector.x, y: from.y + vector.y };
  monster.x = to.x;
  monster.y = to.y;

  events.push({
    type: 'move',
    entity: monster.type,
    entityId: monster.id,
    from,
    to: { ...to },
  });

  if (samePosition(monster, state.player)) {
    state.status = GAME_STATUS.LOST;
    events.push({ type: 'lost', reason: 'caught' });
    return false;
  }

  if (tileAt(state, to.x, to.y) === TILE.KEY) {
    state.doorsOpen = !state.doorsOpen;
    events.push({ type: 'doors', open: state.doorsOpen });
  }
  return true;
}

export function moveAllMonsters(state, events) {
  const order = [MONSTER_TYPE.WHITE, MONSTER_TYPE.RED, MONSTER_TYPE.SCORPION];
  const monsters = [...state.monsters].sort(
    (left, right) => order.indexOf(left.type) - order.indexOf(right.type),
  );

  for (const monster of monsters) {
    const steps = monster.type === MONSTER_TYPE.SCORPION ? 1 : 2;
    for (let index = 0; index < steps; index += 1) {
      if (state.status !== GAME_STATUS.PLAYING) return;
      if (!moveMonsterOnce(state, monster, events)) break;
    }
  }
}
