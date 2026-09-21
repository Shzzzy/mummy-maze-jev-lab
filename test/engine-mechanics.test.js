import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/engine/engine.js';
import { GAME_STATUS } from '../src/engine/constants.js';

test('玩家踩陷阱失败，怪物踩陷阱安全', () => {
  const playerLevel = {
    id: 'trap-player',
    name: '陷阱',
    tiles: ['#####', '#PT#', '#####'],
    monsters: [],
    doorsOpen: false,
  };
  assert.equal(stepGame(createGame(playerLevel), 'right').state.status, GAME_STATUS.LOST);

  const monsterLevel = {
    id: 'trap-monster',
    name: '陷阱',
    tiles: ['#########', '#W.T..P.#', '#.......#', '#########'],
    monsters: [],
    doorsOpen: false,
  };
  const result = stepGame(createGame(monsterLevel), 'right');
  assert.equal(result.state.monsters[0].x, 3);
});

test('任意单位进入钥匙都会切换全部闸门', () => {
  const level = {
    id: 'door',
    name: '门',
    tiles: ['#######', '#PK.G.E#', '#.....#', '#######'],
    monsters: [],
    doorsOpen: false,
  };
  const opened = stepGame(createGame(level), 'right');
  assert.equal(opened.state.doorsOpen, true);
});

test('怪物不能进入另一只怪物所在格', () => {
  const level = {
    id: 'block',
    name: '卡位',
    tiles: ['#########', '#WRS..P..#', '#........#', '#########'],
    monsters: [],
    doorsOpen: false,
  };
  const result = stepGame(createGame(level), 'right');
  assert.deepEqual(
    result.state.monsters.map(({ x, y }) => ({ x, y })),
    [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 4, y: 1 }],
  );
});

test('事件顺序固定为玩家、白色、红色、蝎子', () => {
  const level = {
    id: 'order',
    name: '顺序',
    tiles: ['##########', '#W.R.S..P#', '#........#', '##########'],
    monsters: [],
    doorsOpen: false,
  };
  const result = stepGame(createGame(level), 'left');
  const movingEntities = result.events
    .filter((event) => event.type === 'move')
    .map((event) => event.entity);
  assert.deepEqual(movingEntities, ['player', 'white', 'red', 'scorpion']);
});
