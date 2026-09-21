import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/engine/levels.js';
import { createGame, stepGame } from '../src/engine/engine.js';
import { GAME_STATUS } from '../src/engine/constants.js';

test('首版固定为六关', () => {
  assert.deepEqual(
    LEVELS.map((level) => level.id),
    ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6'],
  );
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
