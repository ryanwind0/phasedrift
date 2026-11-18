// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const SHIP = {
  radius: 16,
  speed: 520,
  invulnerable: 1.6,
  /** Phase energy: how fast it drains while phased, and how fast it comes back. */
  drain: 32,
  regen: 10,
  max: 100,
  start: 100,
};

export const SHIELD = 3;

export const SHARD = {
  minRadius: 14,
  maxRadius: 34,
  speed: 230,
  speedPerLevel: 26,
  speedJitter: 120,
  interval: 0.52,
  intervalScale: 0.9,
  minInterval: 0.22,
  dodgePoints: 1,
  grazePoints: 2,
  /** Seconds between wall formations (a vertical line of shards with one gap). */
  wallEvery: 14,
  wallGap: 190,
};

export const CELL = {
  radius: 11,
  speed: 200,
  speedPerLevel: 12,
  interval: 1.6,
  intervalJitter: 0.9,
  points: 10,
  energy: 22,
};

/** Seconds of play per level, and the last level: speeds and spawn rates stop growing there. */
export const LEVEL = { seconds: 15, max: 10 };

/** How many shards and cells can exist at once; the pools are allocated once, at boot. */
export const POOL_SIZE = 96;
/** How many particles can exist at once; the pool is allocated once, at boot. */
export const PARTICLE_POOL = 240;

export const PALETTE = {
  backdrop: '#07060f',
  deep: '#0d0a1e',
  nebulaA: '#2b1a4d',
  nebulaB: '#0e2a3d',
  ship: '#4de8ff',
  shipGhost: '#b78cff',
  shard: '#ff4d6d',
  shardEdge: '#ff8fa3',
  cell: '#ffd166',
  cellCore: '#fff3c4',
  particle: '#8ef6ff',
  panel: '#141126',
  panelEdge: '#3b2f66',
  text: '#f2f0ff',
  muted: '#9a94c2',
  bar: '#2a2447',
  barFill: '#b78cff',
  barLow: '#ff5d7a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'phasedrift.best';
