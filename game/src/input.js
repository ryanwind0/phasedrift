// Keyboard and pointer input. Held keys give a steering vector; holding Space (or the pointer)
// phases the ship; one-shot presses (start or restart, pause, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const PHASE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let phaseKey = false;
  let phasePointer = false;
  let actions = 0;
  /** The pointer's position in CSS pixels, or null when it never moved. */
  let pointer = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (PHASE.has(event.code)) {
      phaseKey = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (PHASE.has(event.code)) phaseKey = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    phaseKey = false;
    phasePointer = false;
  });
  target.addEventListener('pointerdown', (event) => {
    phasePointer = true;
    pointer = { x: event.clientX, y: event.clientY };
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', () => {
    phasePointer = false;
  });
  target.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
  });

  return {
    /** Steering as { x: -1..1, y: -1..1 }: keys, or toward the pointer when it moved. */
    steer() {
      const kx = (right ? 1 : 0) - (left ? 1 : 0);
      const ky = (down ? 1 : 0) - (up ? 1 : 0);
      if (kx !== 0 || ky !== 0) return { x: kx, y: ky, byPointer: false };
      if (pointer !== null) return { x: pointer.x, y: pointer.y, byPointer: true };
      return { x: 0, y: 0, byPointer: false };
    },
    /** True while the player holds phase (Space or the pointer). */
    phasing() {
      return phaseKey || phasePointer;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
