// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Neon glow,
// a parallax starfield, particles, a HUD and the panels. Text that holds a number is rebuilt only
// when the number changes, so a frame allocates nothing.
import { FIELD, FONT, PALETTE, SHIELD } from './config.js';
import { KIND_CELL } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 640, top: 138, line: 34, bottom: 72 };
const ENERGY = { x: 340, y: FIELD.height - 44, width: 600, height: 16 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

/** A jagged shard outline, drawn once into an offscreen canvas per radius bucket. */
function shardPath(context, radius, seed) {
  const points = 7;
  context.beginPath();
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 0.72 + (((seed * 31 + i * 17) % 29) / 29) * 0.5;
    const r = radius * wobble;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const levelLabel = cachedLabel('LEVEL ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');

  // The starfield: two parallax layers, placed once, drifting left at their own speed.
  const stars = [];
  for (let layer = 0; layer < 2; layer += 1) {
    const count = layer === 0 ? 90 : 50;
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: ((i * 7919 + layer * 104729) % 1280),
        y: ((i * 104729 + layer * 7919) % 720),
        size: layer === 0 ? 1.4 : 2.4,
        speed: layer === 0 ? 12 : 30,
        twinkle: ((i * 13) % 10) / 10,
      });
    }
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(elapsed) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.deep);
    gradient.addColorStop(1, PALETTE.backdrop);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Two slow nebula glows, breathing gently.
    const breathe = 0.75 + Math.sin(elapsed * 0.4) * 0.25;
    let nebula = context.createRadialGradient(300, 180, 20, 300, 180, 420);
    nebula.addColorStop(0, `rgba(43, 26, 77, ${0.55 * breathe})`);
    nebula.addColorStop(1, 'rgba(43, 26, 77, 0)');
    context.fillStyle = nebula;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    nebula = context.createRadialGradient(1020, 560, 20, 1020, 560, 460);
    nebula.addColorStop(0, `rgba(14, 42, 61, ${0.5 * breathe})`);
    nebula.addColorStop(1, 'rgba(14, 42, 61, 0)');
    context.fillStyle = nebula;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Stars drift left and twinkle; the far layer moves slower.
    for (let i = 0; i < stars.length; i += 1) {
      const star = stars[i];
      const x = (((star.x - elapsed * star.speed) % FIELD.width) + FIELD.width) % FIELD.width;
      const alpha = 0.35 + 0.65 * Math.abs(Math.sin(elapsed * 0.9 + star.twinkle * Math.PI * 2));
      context.globalAlpha = alpha * (star.size > 2 ? 0.9 : 0.6);
      context.fillStyle = '#cfe8ff';
      context.fillRect(x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
  }

  function drawShip(ship, elapsed) {
    const ghost = ship.phased;
    const blink = ship.invulnerable > 0 && Math.floor(ship.invulnerable * 10) % 2 === 0;
    if (blink) return;
    context.save();
    context.translate(ship.x, ship.y);
    context.globalAlpha = ghost ? 0.55 : 1;
    context.shadowBlur = 22;
    context.shadowColor = ghost ? PALETTE.shipGhost : PALETTE.ship;
    // The hull: a sleek dart pointing right, with a cockpit dot.
    context.fillStyle = ghost ? PALETTE.shipGhost : PALETTE.ship;
    context.beginPath();
    context.moveTo(20, 0);
    context.lineTo(-12, -11);
    context.lineTo(-6, 0);
    context.lineTo(-12, 11);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = ghost ? '#e6dbff' : '#ffffff';
    context.beginPath();
    context.arc(4, 0, 3.5, 0, Math.PI * 2);
    context.fill();
    // A faint halo while phased, so ghost form reads at a glance.
    if (ghost) {
      context.globalAlpha = 0.25 + 0.1 * Math.sin(elapsed * 6);
      context.strokeStyle = PALETTE.shipGhost;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, ship.radius + 6, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function drawItems(state, elapsed) {
    const items = state.items;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.active) continue;
      if (item.kind === KIND_CELL) {
        const pulse = 1 + Math.sin(elapsed * 5 + item.y) * 0.18;
        context.save();
        context.translate(item.x, item.y);
        context.shadowBlur = 18;
        context.shadowColor = PALETTE.cell;
        context.fillStyle = PALETTE.cell;
        context.beginPath();
        context.arc(0, 0, item.radius * pulse, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
        context.fillStyle = PALETTE.cellCore;
        context.beginPath();
        context.arc(0, 0, item.radius * 0.45 * pulse, 0, Math.PI * 2);
        context.fill();
        context.restore();
        continue;
      }
      context.save();
      context.translate(item.x, item.y);
      context.rotate(item.angle);
      context.shadowBlur = 14;
      context.shadowColor = PALETTE.shard;
      context.fillStyle = PALETTE.shard;
      shardPath(context, item.radius, index);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = PALETTE.shardEdge;
      context.lineWidth = 1.5;
      context.globalAlpha = 0.8;
      shardPath(context, item.radius, index);
      context.stroke();
      context.restore();
    }
  }

  function drawParticles(state) {
    const particles = state.particles;
    for (let index = 0; index < particles.length; index += 1) {
      const p = particles[index];
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 28, 20, 30, PALETTE.text, 'left', '700');
    text(levelLabel(state.level), FIELD.width / 2, 22, 24, PALETTE.muted, 'center', '600');
    text(bestLabel(best), FIELD.width - 28, 22, 24, PALETTE.muted, 'right', '600');
    // Shield pips: three small diamonds, filled while the shield holds.
    const pipX = FIELD.width - 28;
    const pipY = 62;
    for (let i = 0; i < SHIELD; i += 1) {
      const x = pipX - i * 30;
      context.fillStyle = i < state.shield ? PALETTE.ship : PALETTE.bar;
      context.beginPath();
      context.moveTo(x, pipY);
      context.lineTo(x + 9, pipY + 9);
      context.lineTo(x, pipY + 18);
      context.lineTo(x - 9, pipY + 9);
      context.closePath();
      context.fill();
    }
    text('SHIELD', pipX - SHIELD * 30 - 12, 62, 20, PALETTE.muted, 'right', '600');
    // Phase energy bar, bottom centre.
    const energy = state.ship.energy / 100;
    const low = energy < 0.25;
    context.textBaseline = 'alphabetic';
    text(state.ship.phased ? 'PHASED — slipping through' : 'PHASE — hold SPACE / mouse', FIELD.width / 2, ENERGY.y - 10, 18, low ? PALETTE.barLow : PALETTE.muted, 'center', '600');
    context.fillStyle = PALETTE.bar;
    context.fillRect(ENERGY.x, ENERGY.y, ENERGY.width, ENERGY.height);
    context.fillStyle = low ? PALETTE.barLow : PALETTE.barFill;
    context.fillRect(ENERGY.x, ENERGY.y, ENERGY.width * energy, ENERGY.height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(ENERGY.x, ENERGY.y, ENERGY.width, ENERGY.height);
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7, 6, 15, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    context.shadowBlur = 24;
    context.shadowColor = accent || PALETTE.ship;
    text(title, FIELD.width / 2, y + 82, 52, PALETTE.text, 'center', '800');
    context.shadowBlur = 0;
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.cell, 'center', '700');
  }

  const TITLE_LINES = [
    'Slip between worlds. Survive the shardstorm.',
    'Steer with arrows / WASD or the mouse — hold SPACE or click to phase.',
    'Phasing slips through shards but drains energy. Catch gold cells to recharge.',
    'Walls of shards have one gap: find it, or phase straight through.',
    '',
  ];
  const PAUSED_LINES = ['The shards will wait for you.'];
  const OVER_LINES = ['', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // A hit shakes the whole view briefly.
    const shake = state.shake > 0 ? (state.shake / 0.35) * 7 : 0;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 2 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 2 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawBackground(state.elapsed);
    drawItems(state, state.elapsed);
    drawParticles(state);
    drawShip(state.ship, state.elapsed);
    // A red flash right after a hit.
    if (state.flash > 0) {
      context.globalAlpha = (state.flash / 0.25) * 0.22;
      context.fillStyle = '#ff4d6d';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.globalAlpha = 1;
    }
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('PHASEDRIFT', TITLE_LINES, 'Press SPACE or click to fly', PALETTE.ship);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume', PALETTE.ship);
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('SIGNAL LOST', OVER_LINES, 'Press SPACE or click to fly again', PALETTE.shard);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
