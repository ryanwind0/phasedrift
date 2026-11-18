// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward from a
// fresh world for a fixed number of steps, steered by a simple autopilot (look ahead, steer away
// from the nearest shard, chase the lowest cell when that is safe, phase when a hit is otherwise
// unavoidable), so the frame is what a short game really looks like and the same seed always gives
// the same frame.
import { FIELD, SHIP } from './config.js';
import { EVENT_OVER, KIND_CELL, KIND_SHARD } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
/**
 * How far ahead, in seconds, the autopilot checks each way it could move: the play scene's pilot
 * looks well ahead and keeps its shield; the end scene's looks only a moment ahead and never
 * phases, so it is caught out once the shards speed up, as a hurried player is.
 */
const HORIZON_PLAY = 0.8;
const HORIZON_END = 0.3;
const SAMPLE = 1 / 30;
const MARGIN = 12;

/** Would the ship, moving vertically at `vy` (-1, 0, 1), be hit within `horizon` seconds? */
function timeToHit(state, vy, horizon, canPhase) {
  const ship = state.ship;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const x = ship.x;
    const y = Math.min(FIELD.height - ship.radius, Math.max(ship.radius, ship.y + vy * SHIP.speed * t));
    for (let index = 0; index < state.items.length; index += 1) {
      const item = state.items[index];
      if (!item.active || item.kind !== KIND_SHARD) continue;
      const ix = item.x - item.speed * t;
      const iy = item.y + item.drift * t;
      const dx = x - ix;
      const dy = y - iy;
      const r = ship.radius + item.radius * 0.85;
      if (dx * dx + dy * dy < r * r) return t;
    }
  }
  return Infinity;
}

/** The nearest cell ahead of the ship, or null. */
function nearestCell(state) {
  let cell = null;
  for (let index = 0; index < state.items.length; index += 1) {
    const item = state.items[index];
    if (!item.active || item.kind !== KIND_CELL) continue;
    if (item.x < state.ship.x) continue;
    if (cell === null || item.x < cell.x) cell = item;
  }
  return cell;
}

/**
 * Steer and phase for one step. `horizon` is how far ahead it looks; `canPhase` is false for the
 * end scene's pilot, which never phases and so is eventually caught.
 */
function autopilot(state, horizon, canPhase) {
  const ship = state.ship;
  const cell = nearestCell(state);
  // Prefer the cell's height when nothing threatens; otherwise prefer the middle.
  let targetY = cell !== null ? cell.y : FIELD.height / 2;
  // Of the three vertical moves, the one hit last (or never); break ties toward the cell.
  let bestVy = 0;
  let bestTime = -1;
  for (const vy of [-1, 0, 1]) {
    const time = timeToHit(state, vy, horizon, canPhase);
    const toward = vy === 0 ? 0 : (targetY > ship.y + 8 ? 1 : targetY < ship.y - 8 ? -1 : 0);
    const score = time === Infinity ? 1000 + (vy === toward ? 10 : 0) : time;
    if (score > bestTime) {
      bestTime = score;
      bestVy = vy;
    }
  }
  // Phase when every move is hit soon and there is energy to spend.
  const soon = timeToHit(state, bestVy, 0.25, canPhase);
  const phase = canPhase && soon !== Infinity && ship.energy > 25;
  return { move: { x: 0, y: bestVy, byPointer: false }, phase };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS * 60; index += 1) {
      world.step(1 / 60, { x: 0, y: Math.sin(index / 30) * 0.5, byPointer: false }, false, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const horizon = name === 'end' ? HORIZON_END : HORIZON_PLAY;
  const canPhase = name !== 'end';
  const total = Math.floor(limit * 60);
  for (let index = 0; index < total; index += 1) {
    const { move, phase } = autopilot(world.state, horizon, canPhase);
    // The play scene's last half-second holds phase, so the frame catches the ship in ghost
    // form with its energy bar draining: the mechanic the game is about, shown, not told.
    const holdPhase = name === 'play' && index >= total - 30 && world.state.ship.energy > 30;
    if (world.step(1 / 60, move, holdPhase || phase, false) & EVENT_OVER) break;
  }
  const over = world.state.shield === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
