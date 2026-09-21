import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/engine/levels.js';
import { createGame, stepGame } from '../src/engine/engine.js';
import { GAME_STATUS, TILE } from '../src/engine/constants.js';

function replay(level) {
  let state = createGame(level);
  let monsterMoves = 0;
  let minThreat = Number.POSITIVE_INFINITY;
  let visitedKey = false;
  let crossedGate = false;

  for (const direction of level.solution) {
    const result = stepGame(state, direction);
    assert.equal(result.accepted, true, `${level.name} 的动作 ${direction} 被阻挡`);
    state = result.state;
    monsterMoves += result.events.filter(
      (event) => event.type === 'move' && event.entity !== 'player',
    ).length;
    if (state.monsters.length) {
      minThreat = Math.min(
        minThreat,
        ...state.monsters.map((monster) => (
          Math.abs(monster.x - state.player.x) + Math.abs(monster.y - state.player.y)
        )),
      );
    }
    const tile = state.tiles[state.player.y][state.player.x];
    visitedKey ||= tile === TILE.KEY;
    crossedGate ||= tile === TILE.GATE;
    if (state.status !== GAME_STATUS.PLAYING) break;
  }

  return { state, monsterMoves, minThreat, visitedKey, crossedGate };
}

test('首版固定为六个难度递增的关卡', () => {
  assert.deepEqual(
    LEVELS.map((level) => level.id),
    ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6'],
  );
  assert.deepEqual(
    LEVELS.map((level) => level.difficulty),
    [1, 2, 3, 4, 5, 6],
  );
});

for (const level of LEVELS) {
  test(`${level.name} 的怪物会真实追击且路线可以通关`, () => {
    const result = replay(level);
    assert.equal(result.state.status, GAME_STATUS.WON);
    assert.ok(result.monsterMoves > 0, '关卡必须让怪物实际移动');
    assert.ok(result.minThreat <= 3, '路线必须至少一次接近怪物形成压力');
  });
}

test('钥匙关卡必须实际踩钥匙并穿过闸门', () => {
  for (const level of LEVELS.slice(2)) {
    const result = replay(level);
    assert.equal(result.visitedKey, true, `${level.name} 没有实际使用钥匙`);
    assert.equal(result.crossedGate, true, `${level.name} 没有实际穿过闸门`);
  }
});
