import { GAME_STATUS, MONSTER_TYPE, TILE } from './constants.js';

const TILE_BY_SYMBOL = {
  '#': TILE.WALL,
  '.': TILE.FLOOR,
  E: TILE.EXIT,
  T: TILE.TRAP,
  K: TILE.KEY,
  G: TILE.GATE,
};

const MONSTER_BY_SYMBOL = {
  W: MONSTER_TYPE.WHITE,
  R: MONSTER_TYPE.RED,
  S: MONSTER_TYPE.SCORPION,
};

export function createGame(level) {
  const tiles = [];
  const monsters = [];
  let player = null;

  level.tiles.forEach((row, y) => {
    const tileRow = [];
    [...row].forEach((symbol, x) => {
      if (symbol === 'P') {
        player = { x, y };
        tileRow.push(TILE.FLOOR);
        return;
      }
      if (MONSTER_BY_SYMBOL[symbol]) {
        monsters.push({
          id: `${MONSTER_BY_SYMBOL[symbol]}-${monsters.length + 1}`,
          type: MONSTER_BY_SYMBOL[symbol],
          x,
          y,
        });
        tileRow.push(TILE.FLOOR);
        return;
      }
      tileRow.push(TILE_BY_SYMBOL[symbol] ?? TILE.FLOOR);
    });
    tiles.push(tileRow);
  });

  if (!player) {
    throw new Error(`关卡 ${level.id} 缺少玩家起点`);
  }

  return {
    levelId: level.id,
    levelName: level.name,
    width: level.tiles[0].length,
    height: level.tiles.length,
    tiles,
    player,
    monsters,
    doorsOpen: Boolean(level.doorsOpen),
    turn: 0,
    status: GAME_STATUS.PLAYING,
    lastEvents: [],
  };
}

export function tileAt(state, x, y) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) {
    return TILE.WALL;
  }
  return state.tiles[y][x];
}
