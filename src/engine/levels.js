const UP = 'up';
const RIGHT = 'right';

function repeat(direction, count) {
  return Array.from({ length: count }, () => direction);
}

export const LEVELS = [
  {
    id: 'level-1',
    name: '第一关：白木乃伊',
    tiles: ['#########', '#W#....E#', '###.###.#', '#.....#.#', '#.###.#.#', '#.....#.#', '#.#####.#', '#P......#', '#########'],
    monsters: [], doorsOpen: false, solution: [...repeat(RIGHT, 6), ...repeat(UP, 6)],
  },
  {
    id: 'level-2',
    name: '第二关：红木乃伊',
    tiles: ['#########', '#R#....E#', '###.###.#', '#.....#.#', '#.###.#.#', '#.###.#.#', '#T#####.#', '#P......#', '#########'],
    monsters: [], doorsOpen: false, solution: [...repeat(RIGHT, 6), ...repeat(UP, 6)],
  },
  {
    id: 'level-3',
    name: '第三关：蝎子与闸门',
    tiles: ['#########', '#S#....E#', '###.###G#', '#.....#.#', '#.###.#.#', '#.###.#.#', '#T#####.#', '#PK.....#', '#########'],
    monsters: [], doorsOpen: false, solution: [...repeat(RIGHT, 6), ...repeat(UP, 6)],
  },
  {
    id: 'level-4',
    name: '第四关：双重追击',
    tiles: ['#########', '#W#....E#', '###G###G#', '#R#...#.#', '##.##.#.#', '#.###.#.#', '#T#####.#', '#PK.....#', '#########'],
    monsters: [], doorsOpen: false, solution: [...repeat(RIGHT, 6), ...repeat(UP, 6)],
  },
  {
    id: 'level-5',
    name: '第五关：陷阱与机关',
    tiles: ['#########', '#W#....E#', '###.###G#', '#S#...#.#', '##.##.#.#', '#T###.#.#', '#T#####.#', '#PK.....#', '#########'],
    monsters: [], doorsOpen: false, solution: [...repeat(RIGHT, 6), ...repeat(UP, 6)],
  },
  {
    id: 'level-6',
    name: '第六关：金字塔深处',
    tiles: ['#########', '#W#R#..E#', '###.###G#', '#S#...#.#', '##.##.#.#', '#T###.#.#', '#T#####.#', '#PK.....#', '#########'],
    monsters: [], doorsOpen: false, solution: [...repeat(RIGHT, 6), ...repeat(UP, 6)],
  },
];
