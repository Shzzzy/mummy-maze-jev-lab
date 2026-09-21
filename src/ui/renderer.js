import { MONSTER_TYPE, TILE } from '../engine/constants.js';

const COLORS = {
  floor: '#2d2115',
  wall: '#7b5a2c',
  exit: '#2d8159',
  trap: '#a83d32',
  key: '#dcb64f',
  gateOpen: '#587044',
  gateClosed: '#7a431f',
};

function drawTile(context, tile, state, x, y, cell) {
  if (tile === TILE.WALL) {
    const gradient = context.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
    gradient.addColorStop(0, '#987241');
    gradient.addColorStop(1, '#5c3f1d');
    context.fillStyle = gradient;
    context.fillRect(x * cell, y * cell, cell, cell);
    context.strokeStyle = '#3a2712';
    context.lineWidth = 2;
    context.strokeRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
    return;
  }

  if (tile === TILE.GATE) {
    context.fillStyle = state.doorsOpen ? COLORS.gateOpen : COLORS.gateClosed;
    context.fillRect(x * cell, y * cell, cell, cell);
    context.strokeStyle = '#e1b55a';
    context.lineWidth = Math.max(2, cell * 0.08);
    if (state.doorsOpen) {
      context.beginPath();
      context.moveTo(x * cell + cell * 0.25, y * cell + cell * 0.2);
      context.lineTo(x * cell + cell * 0.25, y * cell + cell * 0.8);
      context.stroke();
    } else {
      for (let offset = 0.25; offset < 1; offset += 0.25) {
        context.beginPath();
        context.moveTo(x * cell + cell * offset, y * cell + cell * 0.18);
        context.lineTo(x * cell + cell * offset, y * cell + cell * 0.82);
        context.stroke();
      }
    }
    return;
  }

  context.fillStyle = COLORS[tile] ?? COLORS.floor;
  context.fillRect(x * cell, y * cell, cell, cell);
  context.strokeStyle = '#1a120b';
  context.lineWidth = 1;
  context.strokeRect(x * cell, y * cell, cell, cell);

  if (tile === TILE.TRAP) {
    context.strokeStyle = '#f4c3a8';
    context.lineWidth = Math.max(2, cell * 0.07);
    context.beginPath();
    context.moveTo(x * cell + cell * 0.28, y * cell + cell * 0.28);
    context.lineTo(x * cell + cell * 0.72, y * cell + cell * 0.72);
    context.moveTo(x * cell + cell * 0.72, y * cell + cell * 0.28);
    context.lineTo(x * cell + cell * 0.28, y * cell + cell * 0.72);
    context.stroke();
  }

  if (tile === TILE.KEY) {
    context.fillStyle = COLORS.key;
    context.beginPath();
    context.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * 0.16, 0, Math.PI * 2);
    context.fill();
    context.fillRect((x + 0.5) * cell, (y + 0.45) * cell, cell * 0.25, cell * 0.08);
  }

  if (tile === TILE.EXIT) {
    context.strokeStyle = '#d8f0c0';
    context.lineWidth = Math.max(2, cell * 0.08);
    context.beginPath();
    context.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * 0.24, Math.PI, 0);
    context.lineTo(x * cell + cell * 0.74, y * cell + cell * 0.76);
    context.lineTo(x * cell + cell * 0.26, y * cell + cell * 0.76);
    context.closePath();
    context.stroke();
  }
}

function drawEntity(context, entity, state, cell, entityType = entity.type) {
  const centerX = (entity.x + 0.5) * cell;
  const centerY = (entity.y + 0.5) * cell;
  const radius = cell * 0.32;

  context.save();
  context.shadowColor = '#000';
  context.shadowBlur = cell * 0.18;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = entityType === MONSTER_TYPE.WHITE
    ? '#ede2c4'
    : entityType === MONSTER_TYPE.RED
      ? '#c94235'
      : entityType === MONSTER_TYPE.SCORPION
        ? '#6e963d'
        : '#53bed4';
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = '#120c07';
  context.lineWidth = Math.max(2, cell * 0.08);
  context.stroke();

  context.fillStyle = '#160e08';
  context.beginPath();
  context.arc(centerX - radius * 0.32, centerY - radius * 0.12, radius * 0.1, 0, Math.PI * 2);
  context.arc(centerX + radius * 0.32, centerY - radius * 0.12, radius * 0.1, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function renderGame(canvas, state) {
  const context = canvas.getContext('2d');
  const size = Math.min(canvas.width, canvas.height);
  const cell = size / state.width;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#140e08';
  context.fillRect(0, 0, canvas.width, canvas.height);

  state.tiles.forEach((row, y) => {
    row.forEach((tile, x) => drawTile(context, tile, state, x, y, cell));
  });
  state.monsters.forEach((monster) => drawEntity(context, monster, state, cell));
  drawEntity(context, state.player, state, cell, 'player');
}

function interpolate(from, to, progress) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

async function animateMove(canvas, state, event, durationMs) {
  const startedAt = performance.now();
  await new Promise((resolve) => {
    function frame(now) {
      const progress = Math.min(1, (now - startedAt) / Math.max(1, durationMs));
      const display = structuredClone(state);
      if (event.entity === 'player') {
        display.player = interpolate(event.from, event.to, progress);
      } else {
        const monster = display.monsters.find((item) => item.id === event.entityId);
        if (monster) Object.assign(monster, interpolate(event.from, event.to, progress));
      }
      renderGame(canvas, display);
      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

export async function animateEvents(canvas, state, events, durationMs = 180) {
  for (const event of events) {
    if (event.type === 'move') {
      await animateMove(canvas, state, event, durationMs);
    }
  }
  renderGame(canvas, state);
}
