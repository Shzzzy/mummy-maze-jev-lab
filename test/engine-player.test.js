import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/engine/engine.js';
import { GAME_STATUS } from '../src/engine/constants.js';

const level = {
  id: 'test-player',
  name: '玩家测试',
  tiles: ['#####', '#P.E#', '#####'],
  monsters: [],
  doorsOpen: false,
};

test('玩家每次只移动一格', () => {
  const result = stepGame(createGame(level), 'right');
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.player, { x: 2, y: 1 });
  assert.equal(result.events[0].type, 'move');
});

test('玩家进入出口立即通关', () => {
  const first = stepGame(createGame(level), 'right');
  const second = stepGame(first.state, 'right');
  assert.equal(second.state.status, GAME_STATUS.WON);
});

test('玩家不能进入墙壁，墙壁尝试不触发回合', () => {
  const initial = createGame(level);
  const result = stepGame(initial, 'up');
  assert.equal(result.accepted, false);
  assert.equal(result.state.turn, 0);
  assert.deepEqual(result.state.player, initial.player);
});
