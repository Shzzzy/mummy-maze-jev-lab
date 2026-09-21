function findExit(tiles) {
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      if (tiles[y][x] === 'exit') return { x, y };
    }
  }
  return null;
}

function summarizeDecision(decision) {
  if (!decision) return null;
  return {
    direction: decision.direction,
    score: decision.score,
    confidence: decision.confidence,
    scores: Object.fromEntries(
      Object.entries(decision.scores ?? {}).map(([direction, item]) => [
        direction,
        { score: item.score, confidence: item.confidence },
      ]),
    ),
  };
}

export function createTextState({ state, aiStatus = '手动', lastDecision = null }) {
  return JSON.stringify({
    coordinateSystem: 'x 向右递增，y 向下递增；up 为 y-1，down 为 y+1，left 为 x-1，right 为 x+1',
    levelId: state.levelId,
    levelName: state.levelName,
    turn: state.turn,
    status: state.status,
    player: { x: state.player.x, y: state.player.y },
    monsters: state.monsters.map((monster) => ({
      id: monster.id,
      type: monster.type,
      x: monster.x,
      y: monster.y,
    })),
    exit: findExit(state.tiles),
    doorsOpen: state.doorsOpen,
    aiStatus,
    lastDecision: summarizeDecision(lastDecision),
  });
}
