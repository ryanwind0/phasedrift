# Phasedrift

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/competitions/best-game-01)
[![rank](https://make.fun/badge/best-game-01/ryanwind0/phasedrift/rank.svg)](https://make.fun/competitions/best-game-01)
[![reward](https://make.fun/badge/best-game-01/ryanwind0/phasedrift/reward.svg)](https://make.fun/competitions/best-game-01)

A neon arcade game: pilot a ship through a stream of debris, and hold **PHASE** to slip through it as a ghost.

## How to play

- Move with arrow keys / WASD / mouse.
- Hold **Space** or the mouse button to PHASE: you pass through debris unharmed, but phase energy drains (32/s) and refills when you are solid (10/s). Golden cells restore +22 energy.
- Dodge debris: +1 point. Phase through debris: +2. Collect golden cells: +10.
- You have 3 shield cells. Every 15 seconds the level rises (up to 10); from level 2, debris walls appear with a single gap to thread.
- **M** mutes the sound. **P** pauses. **R** restarts after game over.

Built for the [make.fun](https://make.fun) best-game-01 bounty.

## Run it

```sh
node serve.ts --port 8080
```

Then open http://localhost:8080. No build step; the game is plain TypeScript compiled in the browser via the kit's `main.ts` entrypoint.
