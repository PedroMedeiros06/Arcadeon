// Efeitos sonoros do DrawIt sintetizados com Web Audio API (mesma ideia da Corrida): sem arquivos,
// sem lib. Tudo curto e baixo. Se o navegador bloquear audio, o jogo segue mudo sem erro.

export const DRAW_SOUND_MUTED_KEY = "drawSoundMuted";

export type DrawSfx =
  | "join"
  | "yourTurn"
  | "turnStart"
  | "tick"
  | "wrong"
  | "close"
  | "correct"
  | "otherCorrect"
  | "turnEnd"
  | "win"
  | "gameEnd"
  | "pick";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let listening = false;
const lastPlayed = new Map<DrawSfx, number>();

function isMuted(): boolean {
  try {
    return window.localStorage.getItem(DRAW_SOUND_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Autoplay: o AudioContext so toca depois de um gesto do usuario. Chamado uma vez ao montar o jogo. */
export function initDrawSound(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const unlock = () => {
    const c = ensureCtx();
    if (c && c.state === "suspended") void c.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.6, slideTo?: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(master!);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noise(c: AudioContext, start: number, dur: number, freq: number, gain = 0.4, freqTo?: number) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(freq, start);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(start);
}

export function playDrawSfx(name: DrawSfx): void {
  if (typeof window === "undefined" || isMuted()) return;
  const c = ensureCtx();
  if (!c || c.state !== "running" || !master) return;
  // evita empilhar o mesmo som (varios chutes errados chegando juntos)
  const nowMs = performance.now();
  if (nowMs - (lastPlayed.get(name) ?? 0) < 120) return;
  lastPlayed.set(name, nowMs);

  const t = c.currentTime + 0.01;
  try {
    switch (name) {
      case "join":
        tone(c, 660, t, 0.08, "sine", 0.4);
        tone(c, 880, t + 0.07, 0.1, "sine", 0.4);
        break;
      case "pick":
        tone(c, 880, t, 0.06, "triangle", 0.35);
        break;
      case "yourTurn":
        [523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.09, 0.14, "triangle", 0.45));
        break;
      case "turnStart":
        tone(c, 440, t, 0.25, "triangle", 0.4, 880);
        noise(c, t, 0.2, 800, 0.15, 2600);
        break;
      case "tick":
        tone(c, 520, t, 0.07, "square", 0.14);
        break;
      case "wrong":
        tone(c, 300, t, 0.12, "sine", 0.22, 220);
        break;
      case "close":
        tone(c, 740, t, 0.08, "sine", 0.35);
        tone(c, 700, t + 0.1, 0.12, "sine", 0.3);
        break;
      case "correct":
        [660, 880, 1175].forEach((f, i) => tone(c, f, t + i * 0.07, i === 2 ? 0.3 : 0.1, "sine", 0.5));
        noise(c, t + 0.14, 0.25, 3000, 0.12, 6000);
        break;
      case "otherCorrect":
        tone(c, 880, t, 0.07, "sine", 0.3);
        tone(c, 1175, t + 0.06, 0.1, "sine", 0.3);
        break;
      case "turnEnd":
        tone(c, 784, t, 0.12, "triangle", 0.4);
        tone(c, 587, t + 0.12, 0.22, "triangle", 0.4);
        break;
      case "win":
        [523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, f, t + i * 0.1, i === 4 ? 0.45 : 0.18, "triangle", 0.45));
        break;
      case "gameEnd":
        [523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.12, i === 2 ? 0.35 : 0.16, "triangle", 0.4));
        break;
    }
  } catch {
    // audio nunca derruba o jogo
  }
}
