import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/engine/engine.js';

function levelWithMonster(symbol) {
  return {
    id: 'monster-test',
    name: '怪物测试',
    tiles: ['##########', `#${symbol}.......#`, '#........#', '#........#', '#.......P#', '##########'],
    monsters: [],
    doorsOpen: false,
  };
}

test('白色木乃伊优先水平向玩家移动两步', () => {
  const result = stepGame(createGame(levelWithMonster('W')), 'up');
  const monster = result.state.monsters[0];
  assert.deepEqual({ x: monster.x, y: monster.y }, { x: 3, y: 1 });
});

test('红色木乃伊优先垂直向玩家移动两步', () => {
  const result = stepGame(createGame(levelWithMonster('R')), 'up');
  const monster = result.state.monsters[0];
  assert.deepEqual({ x: monster.x, y: monster.y }, { x: 1, y: 3 });
});

test('蝎子只移动一步且优先水平', () => {
  const result = stepGame(createGame(levelWithMonster('S')), 'up');
  const monster = result.state.monsters[0];
  assert.deepEqual({ x: monster.x, y: monster.y }, { x: 2, y: 1 });
});
