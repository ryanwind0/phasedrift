// The game's rules and state, with no drawing and no browser in it: the ship, the pool of shards
// and cells, phase energy, shield, score and level, spawning, collisions and particles. step()
// advances one fixed step and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound. Nothing here allocates after createWorld returns.
import { CELL, FIELD, LEVEL, PARTICLE_POOL, POOL_SIZE, SHARD, SHIELD, SHIP } from './config.js';

export const KIND_SHARD = 0;
export const KIND_CELL = 1;

export const EVENT_HIT = 1;
export const EVENT_CELL = 2;
export const EVENT_OVER = 4;
export const EVENT_PHASE = 8;
export const EVENT_LEVEL = 16;
export const EVENT_GRAZE = 32;

function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

export function createWorld(random) {
  const ship = {
    x: FIELD.width * 0.25,
    y: FIELD.height / 2,
    radius: SHIP.radius,
    invulnerable: 0,
    energy: SHIP.start,
    phased: false,
    trail: 0,
  };
  const items = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    items.push({
      active: false, kind: KIND_SHARD, x: 0, y: 0, radius: 0, speed: 0, drift: 0,
      angle: 0, spin: 0, points: 0, grazed: false,
    });
  }
  const particles = [];
  for (let index = 0; index < PARTICLE_POOL; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0, color: '' });
  }
  const state = {
    ship, items, particles, score: 0, shield: SHIELD, level: 1, elapsed: 0,
    shardTimer: 0, cellTimer: 0, wallTimer: 0, shake: 0, flash: 0,
  };

  function reset() {
    ship.x = FIELD.width * 0.25;
    ship.y = FIELD.height / 2;
    ship.invulnerable = 0;
    ship.energy = SHIP.start;
    ship.phased = false;
    ship.trail = 0;
    for (const item of items) item.active = false;
    for (const p of particles) p.active = false;
    state.score = 0;
    state.shield = SHIELD;
    state.level = 1;
    state.elapsed = 0;
    state.shardTimer = SHARD.interval;
    state.cellTimer = CELL.interval;
    state.wallTimer = SHARD.wallEvery;
    state.shake = 0;
    state.flash = 0;
  }

  function freeItem() {
    for (let index = 0; index < items.length; index += 1) if (!items[index].active) return items[index];
    return null;
  }

  function freeParticle() {
    for (let index = 0; index < particles.length; index += 1) if (!particles[index].active) return particles[index];
    return null;
  }

  function burst(x, y, color, count, speed, size, life) {
    for (let n = 0; n < count; n += 1) {
      const p = freeParticle();
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.max = life * (0.6 + random() * 0.7);
      p.life = p.max;
      p.size = size * (0.6 + random() * 0.8);
      p.color = color;
    }
  }

  function shardSpeed() {
    return SHARD.speed + SHARD.speedPerLevel * (state.level - 1) + random() * SHARD.speedJitter;
  }

  function spawnShard(y) {
    const item = freeItem();
    if (item === null) return;
    item.active = true;
    item.kind = KIND_SHARD;
    item.radius = SHARD.minRadius + random() * (SHARD.maxRadius - SHARD.minRadius);
    item.x = FIELD.width + item.radius + random() * 60;
    item.y = y === undefined ? item.radius + random() * (FIELD.height - item.radius * 2) : y;
    item.speed = shardSpeed();
    item.drift = (random() - 0.5) * 60;
    item.angle = random() * Math.PI * 2;
    item.spin = (random() - 0.5) * 2.4;
    item.points = 5 + Math.floor(random() * 5);
    item.grazed = false;
  }

  /** A vertical wall of shards with one gap the ship can slip through or phase across. */
  function spawnWall() {
    const gapY = 90 + random() * (FIELD.height - 180);
    const step = 64;
    for (let y = step / 2; y < FIELD.height; y += step) {
      if (Math.abs(y - gapY) < SHARD.wallGap / 2) continue;
      spawnShard(y);
    }
  }

  function spawnCell() {
    const item = freeItem();
    if (item === null) return;
    item.active = true;
    item.kind = KIND_CELL;
    item.radius = CELL.radius;
    item.x = FIELD.width + item.radius + random() * 80;
    item.y = item.radius + 20 + random() * (FIELD.height - item.radius * 2 - 40);
    item.speed = CELL.speed + CELL.speedPerLevel * (state.level - 1);
    item.drift = (random() - 0.5) * 30;
    item.angle = 0;
    item.spin = 0;
    item.points = 0;
    item.grazed = false;
  }

  function shardInterval() {
    return Math.max(SHARD.minInterval, SHARD.interval * SHARD.intervalScale ** (state.level - 1));
  }

  /**
   * One fixed step. `move` is { x, y } in -1..1 (or a pointer target when byPointer is set),
   * `wantPhase` is true while the player holds phase. With `harmless` set (the title screen's
   * backdrop) shards drift but nothing touches the ship and nothing scores.
   */
  function step(dt, move, wantPhase, harmless, view) {
    let events = 0;
    state.elapsed += dt;
    const level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (level !== state.level) {
      state.level = level;
      events |= EVENT_LEVEL;
    }

    // Steering: keys move the ship; the pointer pulls it toward the cursor.
    if (move.byPointer && view) {
      const targetX = ((move.x / view.width) * FIELD.width - view.x) / view.scale;
      const targetY = ((move.y / view.height) * FIELD.height - view.y) / view.scale;
      const dx = targetX - ship.x;
      const dy = targetY - ship.y;
      const dist = Math.hypot(dx, dy);
      const max = SHIP.speed * dt;
      if (dist > 1) {
        const stepLen = Math.min(dist, max);
        ship.x += (dx / dist) * stepLen;
        ship.y += (dy / dist) * stepLen;
      }
    } else {
      const len = Math.hypot(move.x, move.y) || 1;
      ship.x += (move.x / len) * SHIP.speed * dt * (move.x !== 0 || move.y !== 0 ? 1 : 0);
      ship.y += (move.y / len) * SHIP.speed * dt * (move.x !== 0 || move.y !== 0 ? 1 : 0);
    }
    ship.x = Math.min(FIELD.width - ship.radius, Math.max(ship.radius, ship.x));
    ship.y = Math.min(FIELD.height - ship.radius, Math.max(ship.radius, ship.y));
    if (ship.invulnerable > 0) ship.invulnerable = Math.max(0, ship.invulnerable - dt);

    // Phase: hold to slip into ghost form; it drains energy, and an empty tank drops it.
    const wasPhased = ship.phased;
    ship.phased = wantPhase && ship.energy > 0 && !harmless;
    if (ship.phased) {
      ship.energy = Math.max(0, ship.energy - SHIP.drain * dt);
      if (!wasPhased) {
        events |= EVENT_PHASE;
        burst(ship.x, ship.y, '#b78cff', 10, 120, 3, 0.5);
      }
      ship.trail -= dt;
      if (ship.trail <= 0) {
        ship.trail = 0.05;
        const p = freeParticle();
        if (p !== null) {
          p.active = true;
          p.x = ship.x - 14;
          p.y = ship.y + (random() - 0.5) * 10;
          p.vx = -60;
          p.vy = 0;
          p.max = 0.4;
          p.life = p.max;
          p.size = 3;
          p.color = '#b78cff';
        }
      }
    } else {
      ship.energy = Math.min(SHIP.max, ship.energy + SHIP.regen * dt);
      ship.trail -= dt;
      if (ship.trail <= 0) {
        ship.trail = 0.03;
        const p = freeParticle();
        if (p !== null) {
          p.active = true;
          p.x = ship.x - 16;
          p.y = ship.y + (random() - 0.5) * 8;
          p.vx = -140;
          p.vy = (random() - 0.5) * 20;
          p.max = 0.3;
          p.life = p.max;
          p.size = 2;
          p.color = '#4de8ff';
        }
      }
    }

    // Spawning.
    state.shardTimer -= dt;
    if (state.shardTimer <= 0) {
      spawnShard();
      state.shardTimer += shardInterval();
    }
    state.cellTimer -= dt;
    if (state.cellTimer <= 0) {
      spawnCell();
      state.cellTimer += CELL.interval + random() * CELL.intervalJitter;
    }
    state.wallTimer -= dt;
    if (state.wallTimer <= 0 && state.level >= 2) {
      spawnWall();
      state.wallTimer += SHARD.wallEvery;
    }

    // Items move, drift, spin; the ones that leave the left edge are dodged.
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.active) continue;
      item.x -= item.speed * dt;
      item.y += item.drift * dt;
      item.angle += item.spin * dt;
      if (item.y < item.radius) {
        item.y = item.radius;
        item.drift = Math.abs(item.drift);
      } else if (item.y > FIELD.height - item.radius) {
        item.y = FIELD.height - item.radius;
        item.drift = -Math.abs(item.drift);
      }
      if (item.x < -item.radius - 20) {
        item.active = false;
        if (item.kind === KIND_SHARD && !harmless) state.score += SHARD.dodgePoints;
        continue;
      }
      if (harmless) continue;
      if (item.kind === KIND_CELL) {
        if (circleHit(ship.x, ship.y, ship.radius + 6, item.x, item.y, item.radius)) {
          item.active = false;
          state.score += CELL.points;
          ship.energy = Math.min(SHIP.max, ship.energy + CELL.energy);
          burst(item.x, item.y, '#ffd166', 14, 180, 3.5, 0.55);
          events |= EVENT_CELL;
        }
        continue;
      }
      // A shard: phased ships slip through it (a graze scores); solid ships take a hit.
      if (!circleHit(ship.x, ship.y, ship.radius, item.x, item.y, item.radius * 0.85)) continue;
      if (ship.phased) {
        if (!item.grazed) {
          item.grazed = true;
          state.score += SHARD.grazePoints;
          events |= EVENT_GRAZE;
        }
        continue;
      }
      if (ship.invulnerable > 0) continue;
      item.active = false;
      state.shield -= 1;
      ship.invulnerable = SHIP.invulnerable;
      state.shake = 0.35;
      state.flash = 0.25;
      burst(ship.x, ship.y, '#ff4d6d', 22, 260, 4, 0.7);
      events |= EVENT_HIT;
      if (state.shield === 0) {
        events |= EVENT_OVER;
        break;
      }
    }

    // Particles fade and drift.
    for (let index = 0; index < particles.length; index += 1) {
      const p = particles[index];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
    return events;
  }

  reset();
  return { state, reset, step, burst };
}
