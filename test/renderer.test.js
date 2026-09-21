import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMoveEvent } from '../src/ui/renderer.js';

test('单步移动事件只推进目标角色，其他怪物保持在原位置', () => {
  const state = {
    doorsOpen: false,
    player: { x: 1, y: 1 },
    monsters: [
      { id: 'white-1', type: 'white', x: 3, y: 1 },
      { id: 'red-1', type: 'red', x: 5, y: 5 },
    ],
  };
  const next = applyMoveEvent(state, {
    type: 'move',
    entity: 'white',
    entityId: 'white-1',
    from: { x: 3, y: 1 },
    to: { x: 4, y: 1 },
  });

  assert.deepEqual(next.monsters[0], { id: 'white-1', type: 'white', x: 4, y: 1 });
  assert.deepEqual(next.monsters[1], { id: 'red-1', type: 'red', x: 5, y: 5 });
  assert.deepEqual(state.monsters[0], { id: 'white-1', type: 'white', x: 3, y: 1 });
});
