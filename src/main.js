import { createGame, stepGame } from './engine/engine.js';
import { LEVELS } from './engine/levels.js';
import { renderGame, animateEvents } from './ui/renderer.js';

const canvas = document.querySelector('#game-canvas');
const message = document.querySelector('#game-message');
const levelName = document.querySelector('#level-name');
const turnCount = document.querySelector('#turn-count');
const elapsedTime = document.querySelector('#elapsed-time');
const aiStatus = document.querySelector('#ai-status');

let levelIndex = 0;
let state = createGame(LEVELS[levelIndex]);
let busy = false;
let levelStartedAt = Date.now();
let aiEnabled = false;

function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function showState() {
  levelName.textContent = `${state.levelName} · ${levelIndex + 1}/${LEVELS.length}`;
  turnCount.textContent = String(state.turn);
  renderGame(canvas, state);
}

function loadLevel(index) {
  levelIndex = index;
  state = createGame(LEVELS[levelIndex]);
  levelStartedAt = Date.now();
  aiEnabled = false;
  aiStatus.textContent = '手动';
  document.querySelector('#ai-button').textContent = 'AI 自动';
  message.textContent = '使用方向键移动探险家';
  showState();
}

let applyDirection = async function applyDirection(direction, { fromAi = false } = {}) {
  if (aiEnabled && !fromAi) return false;
  if (busy || state.status !== 'playing') return false;

  busy = true;
  const result = stepGame(state, direction);
  state = result.state;
  await animateEvents(canvas, state, result.events);
  showState();

  if (state.status === 'won') {
    message.textContent = '过关成功，正在进入下一关';
    if (levelIndex < LEVELS.length - 1) {
      setTimeout(() => loadLevel(levelIndex + 1), 1200);
    } else {
      message.textContent = '六关全部完成，可以导出本次记录';
    }
  } else if (state.status === 'lost') {
    message.textContent = state.lastEvents.at(-1)?.reason === 'trap'
      ? '踩中陷阱，已失败'
      : '被怪物抓住，已失败';
  } else if (!result.accepted) {
    message.textContent = '这个方向无法移动';
  }

  busy = false;
  return result.accepted;
};

document.querySelector('#restart-button').addEventListener('click', () => {
  loadLevel(levelIndex);
});

document.addEventListener('keydown', (event) => {
  const direction = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  }[event.key];
  if (direction && !aiEnabled) applyDirection(direction);
});

window.setInterval(() => {
  if (state.status === 'playing') {
    elapsedTime.textContent = formatDuration(Date.now() - levelStartedAt);
  }
}, 500);

loadLevel(0);
