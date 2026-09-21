import { createGame, stepGame } from './engine/engine.js';
import { LEVELS } from './engine/levels.js';
import { createSnapshot } from './engine/snapshot.js';
import { renderGame, animateEvents } from './ui/renderer.js';
import { requestJevDecision } from './ui/jev-client.js';
import {
  createExport,
  createMetrics,
  recordDecision,
  recordLevelResult,
  summarizeMetrics,
} from './ui/metrics.js';

const canvas = document.querySelector('#game-canvas');
const message = document.querySelector('#game-message');
const levelName = document.querySelector('#level-name');
const turnCount = document.querySelector('#turn-count');
const elapsedTime = document.querySelector('#elapsed-time');
const aiStatus = document.querySelector('#ai-status');
const aiButton = document.querySelector('#ai-button');
const history = document.querySelector('#decision-history');

const metrics = createMetrics();
let levelIndex = 0;
let state = createGame(LEVELS[levelIndex]);
let busy = false;
let aiEnabled = false;
let aiRequestInFlight = false;
let aiRunToken = 0;
let levelStartedAt = Date.now();
let levelTimer = null;
let levelResultRecorded = false;
let levelRunId = 0;

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function currentLevelDecisions() {
  return metrics.decisions.filter((decision) => decision.levelRunId === levelRunId);
}

function renderSummary() {
  const summary = summarizeMetrics({ decisions: currentLevelDecisions() });
  document.querySelector('#average-confidence').textContent = summary.averageConfidence === null
    ? '--'
    : percent(summary.averageConfidence);
  document.querySelector('#average-latency').textContent = summary.averageLatencyMs === null
    ? '--'
    : `${summary.averageLatencyMs} ms`;
  document.querySelector('#total-tokens').textContent = String(summary.totalTokens);
}

function resetDecisionCard() {
  document.querySelector('#yes-no-row').innerHTML = `
    <div class="probability-item muted"><span>Yes</span><strong>--</strong></div>
    <div class="probability-item muted"><span>No</span><strong>--</strong></div>
  `;
  document.querySelector('#direction-probabilities').innerHTML = `
    <div class="probability-item muted"><span>上</span><strong>--</strong></div>
    <div class="probability-item muted"><span>下</span><strong>--</strong></div>
    <div class="probability-item muted"><span>左</span><strong>--</strong></div>
    <div class="probability-item muted"><span>右</span><strong>--</strong></div>
  `;
  document.querySelector('#final-action').textContent = '尚未执行动作';
  document.querySelector('#decision-time').textContent = '等待判断';
  history.replaceChildren();
  renderSummary();
}

function showState() {
  levelName.textContent = `${state.levelName} · ${levelIndex + 1}/${LEVELS.length}`;
  turnCount.textContent = String(state.turn);
  renderGame(canvas, state);
}

function renderDecision(decision) {
  document.querySelector('#yes-no-row').innerHTML = `
    <div class="probability-item"><span>Yes</span><strong>${percent(decision.yesProbability)}</strong></div>
    <div class="probability-item"><span>No</span><strong>${percent(decision.noProbability)}</strong></div>
  `;
  const labels = { up: '上', down: '下', left: '左', right: '右' };
  document.querySelector('#direction-probabilities').innerHTML = Object.entries(labels)
    .map(([direction, label]) => `
      <div class="probability-item ${direction === decision.direction ? 'best' : ''}">
        <span>${label}</span>
        <strong>${percent(decision.probabilities?.[direction])}</strong>
      </div>
    `)
    .join('');
  document.querySelector('#final-action').textContent =
    `最终执行：${labels[decision.direction]}（${percent(decision.confidence)}）`;
  document.querySelector('#decision-time').textContent = `${decision.latencyMs} ms`;
}

function appendDecisionHistory(decision) {
  const labels = { up: '上', down: '下', left: '左', right: '右' };
  const tokens = Number(decision.usage?.input_tokens || 0) + Number(decision.usage?.output_tokens || 0);
  const item = document.createElement('li');
  item.textContent = [
    `第 ${decision.turn} 回合`,
    `${labels[decision.direction] || decision.direction}`,
    `Yes ${percent(decision.yesProbability)} / No ${percent(decision.noProbability)}`,
    `上 ${percent(decision.probabilities?.up)} 下 ${percent(decision.probabilities?.down)} 左 ${percent(decision.probabilities?.left)} 右 ${percent(decision.probabilities?.right)}`,
    `置信度 ${percent(decision.confidence)}`,
    `${decision.latencyMs} ms`,
    `${tokens} token`,
    decision.result,
  ].join(' · ');
  history.prepend(item);
}

function recordResult(result, reason = null) {
  if (levelResultRecorded) return;
  levelResultRecorded = true;
  recordLevelResult(metrics, {
    levelId: state.levelId,
    levelRunId,
    result,
    reason,
    turns: state.turn,
    durationMs: Date.now() - levelStartedAt,
  });
}

function scheduleNextLevel() {
  clearTimeout(levelTimer);
  if (levelIndex < LEVELS.length - 1) {
    levelTimer = setTimeout(() => loadLevel(levelIndex + 1, { keepAi: true }), 1200);
  } else {
    aiEnabled = false;
    aiButton.textContent = 'AI 自动';
    aiStatus.textContent = '全部完成';
    message.textContent = '六关全部完成，可以导出本次记录';
  }
}

function handleOutcome(result) {
  if (state.status === 'won') {
    recordResult('won');
    message.textContent = '过关成功，正在进入下一关';
    scheduleNextLevel();
  } else if (state.status === 'lost') {
    const reason = state.lastEvents.at(-1)?.reason || 'caught';
    recordResult('lost', reason);
    aiEnabled = false;
    aiButton.textContent = 'AI 自动';
    aiStatus.textContent = '已失败';
    message.textContent = reason === 'trap' ? '踩中陷阱，已失败' : '被怪物抓住，已失败';
  } else if (!result.accepted) {
    message.textContent = '这个方向无法移动';
  }
}

async function performTurn(direction) {
  if (busy || state.status !== 'playing') return false;
  busy = true;
  try {
    const result = stepGame(state, direction);
    state = result.state;
    await animateEvents(canvas, state, result.events);
    showState();
    handleOutcome(result);
    return result.accepted;
  } finally {
    busy = false;
  }
}

async function applyDirection(direction, { fromAi = false } = {}) {
  if (aiEnabled && !fromAi) return false;
  return performTurn(direction);
}

function loadLevel(index, { keepAi = false } = {}) {
  clearTimeout(levelTimer);
  levelIndex = index;
  state = createGame(LEVELS[levelIndex]);
  levelStartedAt = Date.now();
  levelResultRecorded = false;
  levelRunId += 1;
  elapsedTime.textContent = '00:00';
  aiEnabled = keepAi ? aiEnabled : false;
  aiRunToken += 1;
  aiRequestInFlight = false;
  aiButton.textContent = aiEnabled ? '停止 AI' : 'AI 自动';
  aiStatus.textContent = aiEnabled ? '准备判断' : '手动';
  message.textContent = '使用方向键移动探险家';
  resetDecisionCard();
  showState();
  if (aiEnabled) queueMicrotask(runAiTurn);
}

function errorMessage(error) {
  if (error.status === 401) return 'API Key 无效，AI 已暂停';
  if (error.status === 422) return 'Jev 请求校验失败，AI 已暂停';
  if (error.status === 429) return 'Jev 请求过于频繁，请稍后重试';
  if (error.status === 504 || error.code === 'JEV_TIMEOUT') return 'Jev 响应超时，AI 已暂停';
  return error.message || 'Jev 请求失败，AI 已暂停';
}

async function runAiTurn() {
  const runToken = aiRunToken;
  if (!aiEnabled || aiRequestInFlight || busy || state.status !== 'playing') return;

  aiRequestInFlight = true;
  aiButton.disabled = true;
  aiStatus.textContent = 'Jev 思考中';
  try {
    const decision = await requestJevDecision(createSnapshot(state));
    if (!aiEnabled || runToken !== aiRunToken) return;

    renderDecision(decision);
    aiStatus.textContent = '执行 Jev 方向';
    const accepted = await performTurn(decision.direction);
    decision.levelId = state.levelId;
    decision.levelRunId = levelRunId;
    decision.turn = Math.max(1, state.turn);
    decision.result = accepted
      ? state.status === 'won' ? '通关' : state.status === 'lost' ? '失败' : '成功'
      : '被阻挡';
    recordDecision(metrics, decision);
    appendDecisionHistory(decision);
    renderSummary();

    if (!accepted) throw new Error('Jev 选择了不可通行方向，AI 已暂停');
  } catch (error) {
    if (runToken === aiRunToken) {
      aiEnabled = false;
      aiButton.textContent = 'AI 自动';
      aiStatus.textContent = '已暂停';
      message.textContent = errorMessage(error);
    }
  } finally {
    aiRequestInFlight = false;
    aiButton.disabled = false;
    if (aiEnabled && runToken === aiRunToken && state.status === 'playing') {
      queueMicrotask(runAiTurn);
    }
  }
}

function downloadMetrics() {
  const blob = new Blob([JSON.stringify(createExport(metrics), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mummy-maze-jev-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

document.querySelector('#restart-button').addEventListener('click', () => loadLevel(levelIndex));
aiButton.addEventListener('click', () => {
  aiEnabled = !aiEnabled;
  aiRunToken += 1;
  aiButton.textContent = aiEnabled ? '停止 AI' : 'AI 自动';
  aiStatus.textContent = aiEnabled ? '准备判断' : '手动';
  if (aiEnabled) queueMicrotask(runAiTurn);
});
document.querySelector('#export-button').addEventListener('click', downloadMetrics);

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

loadLevel(0, { keepAi: false });
