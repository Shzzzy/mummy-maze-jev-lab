import { DIRECTIONS, GAME_STATUS, TILE } from './constants.js';
import { tileAt } from './state.js';
import { moveAllMonsters } from './monsters.js';

function samePosition(left, right) {
  return left.x === right.x && left.y === right.y;
}

function canPlayerEnter(state, x, y) {
  const tile = tileAt(state, x, y);
  if (tile === TILE.WALL) return false;
  if (tile === TILE.GATE && !state.doorsOpen) return false;
  return true;
}

function movePlayer(state, direction, events) {
  const vector = DIRECTIONS[direction];
  if (!vector) return { accepted: false, outcome: null };

  const destination = {
    x: state.player.x + vector.x,
    y: state.player.y + vector.y,
  };
  if (!canPlayerEnter(state, destination.x, destination.y)) {
    return { accepted: false, outcome: null };
  }

  const from = { ...state.player };
  state.player = destination;
  events.push({
    type: 'move',
    entity: 'player',
    entityId: 'player',
    from,
    to: { ...destination },
  });

  if (state.monsters.some((monster) => samePosition(monster, destination))) {
    state.status = GAME_STATUS.LOST;
    events.push({ type: 'lost', reason: 'caught' });
    return { accepted: true, outcome: GAME_STATUS.LOST };
  }

  const tile = tileAt(state, destination.x, destination.y);
  if (tile === TILE.TRAP) {
    state.status = GAME_STATUS.LOST;
    events.push({ type: 'lost', reason: 'trap' });
    return { accepted: true, outcome: GAME_STATUS.LOST };
  }
  if (tile === TILE.KEY) {
    state.doorsOpen = !state.doorsOpen;
    events.push({ type: 'doors', open: state.doorsOpen });
  }
  if (tile === TILE.EXIT) {
    state.status = GAME_STATUS.WON;
    events.push({ type: 'won' });
    return { accepted: true, outcome: GAME_STATUS.WON };
  }

  return { accepted: true, outcome: null };
}

export function stepGame(current, direction) {
  if (current.status !== GAME_STATUS.PLAYING) {
    return { state: current, accepted: false, events: [] };
  }

  const state = structuredClone(current);
  const events = [];
  const playerResult = movePlayer(state, direction, events);
  if (!playerResult.accepted || playerResult.outcome) {
    state.lastEvents = events;
    return { state, accepted: playerResult.accepted, events };
  }

  moveAllMonsters(state, events);
  state.turn += 1;
  state.lastEvents = events;
  return { state, accepted: true, events };
}

export { createGame } from './state.js';
