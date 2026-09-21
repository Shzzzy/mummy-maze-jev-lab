import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextState } from '../src/ui/text-state.js';

test('render_game_to_text 输出简洁且可读的当前状态', () => {
  const state = {
    levelId: 'level-1',
    levelName: '第一关',
    turn: 3,
    status: 'playing',
    doorsOpen: false,
    player: { x: 1, y: 5 },
    monsters: [{ id: 'white-1', type: 'white', x: 3, y: 1 }],
    tiles: [
      ['wall', 'wall', 'wall', 'wall'],
      ['wall', 'floor', 'floor', 'exit'],
      ['wall', 'wall', 'wall', 'wall'],
    ],
  };
  const text = createTextState({
    state,
    aiStatus: '执行最高分动作',
    lastDecision: {
      direction: 'right',
      score: 4.2,
      confidence: 0.87,
      scores: {
        right: { score: 4.2, confidence: 0.87 },
      },
    },
  });
  const payload = JSON.parse(text);
  assert.equal(payload.levelId, 'level-1');
  assert.equal(payload.player.x, 1);
  assert.deepEqual(payload.exit, { x: 3, y: 1 });
  assert.equal(payload.monsters[0].type, 'white');
  assert.equal(payload.lastDecision.direction, 'right');
  assert.match(payload.coordinateSystem, /x 向右/);
});

test('没有决策时 lastDecision 为 null', () => {
  const payload = JSON.parse(createTextState({
    state: {
      levelId: 'level-1',
      levelName: '第一关',
      turn: 0,
      status: 'playing',
      doorsOpen: false,
      player: { x: 1, y: 1 },
      monsters: [],
      tiles: [['wall', 'wall'], ['wall', 'floor']],
    },
  }));
  assert.equal(payload.lastDecision, null);
});
