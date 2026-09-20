/**
 * VIATRA Sound Alert System
 * Plays beep sounds when violations are detected.
 * Uses Web Audio API — no external files needed.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Beep pattern by violation severity
const PATTERNS = {
  no_helmet:      [{ freq:880, dur:0.12 }, { freq:880, dur:0.12 }],
  triple_riding:  [{ freq:660, dur:0.10 }, { freq:880, dur:0.10 }, { freq:1100, dur:0.15 }],
  both:           [{ freq:440, dur:0.08 }, { freq:880, dur:0.08 }, { freq:1320, dur:0.08 }, { freq:880, dur:0.15 }],
  signal_jumping: [{ freq:1047, dur:0.20 }, { freq:1047, dur:0.20 }],
  lane_violation: [{ freq:523, dur:0.15 }],
  wrong_way:      [{ freq:330, dur:0.10 }, { freq:330, dur:0.10 }, { freq:330, dur:0.10 }],
  overspeeding:   [{ freq:784, dur:0.10 }, { freq:1047, dur:0.20 }],
  default:        [{ freq:880, dur:0.15 }],
};

function playTone(freq, dur, startTime, gain = 0.3) {
  const ctx  = getCtx();
  const osc  = ctx.createOscillator();
  const gNode = ctx.createGain();

  osc.connect(gNode);
  gNode.connect(ctx.destination);

  osc.type      = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  gNode.gain.setValueAtTime(0, startTime);
  gNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gNode.gain.linearRampToValueAtTime(0, startTime + dur - 0.01);

  osc.start(startTime);
  osc.stop(startTime + dur);
}

export function playViolationAlert(violationType) {
  try {
    const ctx     = getCtx();
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === "suspended") ctx.resume();

    const pattern = PATTERNS[violationType] || PATTERNS.default;
    let   time    = ctx.currentTime + 0.05;

    pattern.forEach(({ freq, dur }) => {
      playTone(freq, dur, time);
      time += dur + 0.05;
    });
  } catch (e) {
    // Silently fail if audio not available
  }
}

export function playStartupSound() {
  try {
    const ctx  = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const now  = ctx.currentTime;
    // Ascending arpeggio: VIATRA startup
    [523, 659, 784, 1047].forEach((freq, i) => {
      playTone(freq, 0.12, now + i * 0.10, 0.2);
    });
  } catch {}
}

export function playChallanSound() {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    // Success ding
    [784, 1047, 1319].forEach((freq, i) => {
      playTone(freq, 0.15, now + i * 0.12, 0.25);
    });
  } catch {}
}
