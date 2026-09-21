export const TILE = Object.freeze({
  FLOOR: 'floor',
  WALL: 'wall',
  EXIT: 'exit',
  TRAP: 'trap',
  KEY: 'key',
  GATE: 'gate',
});

export const MONSTER_TYPE = Object.freeze({
  WHITE: 'white',
  RED: 'red',
  SCORPION: 'scorpion',
});

export const GAME_STATUS = Object.freeze({
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
});

export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});
