// Web Audio chimes — no audio files needed.
//
// Two short envelope-shaped oscillator notes:
//   playPositive(): C5 sine, 200ms — soft "ding" for a winning pull.
//   playNegative(): A3 triangle, 200ms — gentle "thud" for a losing/zero pull.
//
// AudioContext is created lazily on first call (browser autoplay rules).

let ctx;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function playTone({ freq, type, duration = 0.2, gain = 0.18 }) {
  try {
    const ac = getCtx();
    if (ac.state === "suspended") ac.resume();

    const osc = ac.createOscillator();
    const env = ac.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(env);
    env.connect(ac.destination);

    const t0 = ac.currentTime;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.015);    // quick attack
    env.gain.exponentialRampToValueAtTime(0.001, t0 + duration); // smooth decay

    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch (err) {
    // Silently ignore — game still works without sound.
    console.warn("Audio failed:", err);
  }
}

export function playPositive() {
  playTone({ freq: 523.25, type: "sine", duration: 0.25 });      // C5
  setTimeout(() => playTone({ freq: 659.25, type: "sine", duration: 0.2 }), 80); // E5
}

export function playNegative() {
  playTone({ freq: 220.0, type: "triangle", duration: 0.3, gain: 0.15 }); // A3
}

export function playWin() {
  // Three ascending notes
  playTone({ freq: 523.25, type: "sine", duration: 0.18 });           // C5
  setTimeout(() => playTone({ freq: 659.25, type: "sine", duration: 0.18 }), 120); // E5
  setTimeout(() => playTone({ freq: 783.99, type: "sine", duration: 0.35 }), 240); // G5
}

export function playLose() {
  // Two descending notes
  playTone({ freq: 392.0, type: "triangle", duration: 0.25, gain: 0.18 }); // G4
  setTimeout(() => playTone({ freq: 261.63, type: "triangle", duration: 0.5, gain: 0.15 }), 200); // C4
}
