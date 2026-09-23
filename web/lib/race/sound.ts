// Efeitos sonoros da Corrida sintetizados com Web Audio API: zero arquivos pra baixar, sem lib.
// Tudo curto (<0.6s) e baixo. Se o navegador bloquear audio, o jogo segue mudo sem erro.

export const SOUND_MUTED_KEY = "raceSoundMuted";

export type Sfx =
  | "join"
  | "start"
  | "tick"
  | "go"
  | "question"
  | "hurry"
  | "correct"
  | "wrong"
  | "streakUp"
  | "streakLost"
  | "freeze"
  | "unfreeze"
  | "overtake"
  | "finish"
  | "win"
  | "lose";

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let listening = false;
const lastPlayed = new Map<Sfx, number>();

function isMuted(): boolean {
  try {
    return window.localStorage.getItem(SOUND_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function ensureCtx(): Ctx | null {
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

/** Autoplay: o AudioContext so pode tocar depois de um gesto do usuario. Chamado uma vez ao montar o jogo. */
export function initRaceSound(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const unlock = () => {
    const c = ensureCtx();
    if (c && c.state === "suspended") void c.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function tone(c: Ctx, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.6, slideTo?: number) {
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

function noise(c: Ctx, start: number, dur: number, filter: BiquadFilterType, freq: number, gain = 0.5, freqTo?: number) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, start);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(start);
}

/** level: usado pelo streakUp (tom sobe com a sequencia). */
export function playSfx(name: Sfx, level = 1): void {
  if (typeof window === "undefined" || isMuted()) return;
  const c = ensureCtx();
  if (!c || c.state !== "running" || !master) return;
  // evita empilhar o mesmo som
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
      case "start":
        tone(c, 330, t, 0.3, "triangle", 0.5, 660);
        break;
      case "tick":
        tone(c, 520, t, 0.09, "square", 0.18);
        break;
      case "go":
        tone(c, 784, t, 0.35, "triangle", 0.55);
        tone(c, 1046, t, 0.35, "triangle", 0.4);
        noise(c, t, 0.25, "bandpass", 600, 0.25, 2400);
        break;
      case "question":
        tone(c, 700, t, 0.06, "sine", 0.3);
        tone(c, 1050, t + 0.06, 0.08, "sine", 0.3);
        break;
      case "hurry":
        tone(c, 900, t, 0.05, "square", 0.15);
        tone(c, 900, t + 0.12, 0.05, "square", 0.15);
        break;
      case "correct":
        tone(c, 660, t, 0.09, "sine", 0.5);
        tone(c, 990, t + 0.08, 0.14, "sine", 0.5);
        break;
      case "wrong":
        tone(c, 240, t, 0.22, "sawtooth", 0.18, 150);
        break;
      case "streakUp":
        tone(c, 720 + Math.min(level, 6) * 70, t, 0.1, "triangle", 0.35);
        break;
      case "streakLost":
        tone(c, 520, t, 0.32, "square", 0.16, 130);
        break;
      case "freeze":
        noise(c, t, 0.4, "highpass", 3000, 0.25);
        tone(c, 1800, t, 0.35, "sine", 0.15, 2600);
        break;
      case "unfreeze":
        noise(c, t, 0.18, "bandpass", 2500, 0.5);
        tone(c, 1400, t + 0.02, 0.05, "square", 0.12);
        tone(c, 1900, t + 0.07, 0.05, "square", 0.1);
        break;
      case "overtake":
        noise(c, t, 0.28, "bandpass", 400, 0.35, 2200);
        break;
      case "finish":
        [523, 659, 784, 1046].forEach((f, i) => tone(c, f, t + i * 0.08, 0.16, "triangle", 0.45));
        break;
      case "win":
        [523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, f, t + i * 0.1, i === 4 ? 0.45 : 0.18, "triangle", 0.45));
        break;
      case "lose":
        [440, 392, 349].forEach((f, i) => tone(c, f, t + i * 0.14, 0.2, "sine", 0.3));
        break;
    }
  } catch {
    // audio nunca derruba o jogo
  }
}
