export function createSnapshot(state) {
  return {
    levelId: state.levelId,
    levelName: state.levelName,
    width: state.width,
    height: state.height,
    tiles: state.tiles.map((row) => [...row]),
    player: { ...state.player },
    monsters: state.monsters.map((monster) => ({ ...monster })),
    doorsOpen: state.doorsOpen,
    turn: state.turn,
  };
}
