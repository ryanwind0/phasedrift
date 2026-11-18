// Sound, synthesized live with WebAudio: no audio files, no network. The context is created on
// the first user gesture (a key or a click), since a page may not start audio before one. Every
// effect is a short oscillator or noise burst through one master gain; M mutes it.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, endFreq, duration, type, volume, when) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + (when || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noise(duration, volume, cutoff, when) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + (when || 0);
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  return {
    /** Call on any user gesture so later sounds are allowed to play. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** A bright rising blip: a cell was collected. */
    collect() {
      tone(660, 990, 0.09, 'sine', 0.5, 0);
      tone(990, 1320, 0.08, 'sine', 0.3, 0.05);
    },
    /** A soft airy sweep: the ship slipped into ghost form. */
    phase() {
      tone(320, 120, 0.22, 'sine', 0.35, 0);
      noise(0.18, 0.12, 2400, 0);
    },
    /** A low thud with grit: the ship took a hit. */
    hit() {
      tone(140, 55, 0.22, 'triangle', 0.7, 0);
      noise(0.16, 0.35, 900, 0);
    },
    /** A small rising arpeggio: the level went up. */
    level() {
      tone(523, 523, 0.09, 'sine', 0.35, 0);
      tone(659, 659, 0.09, 'sine', 0.35, 0.08);
      tone(784, 784, 0.14, 'sine', 0.35, 0.16);
    },
    /** Three falling notes: the drift is over. */
    over() {
      tone(392, 392, 0.16, 'triangle', 0.45, 0);
      tone(311, 311, 0.16, 'triangle', 0.45, 0.16);
      tone(233, 196, 0.4, 'triangle', 0.45, 0.32);
    },
  };
}
