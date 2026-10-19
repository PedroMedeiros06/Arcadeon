// Efeitos sonoros do Cofre sintetizados com Web Audio API: zero arquivos pra baixar, sem lib.
// Tudo curto (<0.7s) e baixo. Se o navegador bloquear audio, o jogo segue mudo sem erro.

export const SOUND_MUTED_KEY = "cofreSoundMuted";

export type Sfx =
  | "flip"
  | "match"
  | "coringa"
  | "miss"
  | "swap"
  | "yourTurn"
  | "tick"
  | "timeout"
  | "dial"
  | "open"
  | "win"
  | "lose";

let ctx: AudioContext | null = null;
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

/** Autoplay: o AudioContext so pode tocar depois de um gesto do usuario. Chamado ao montar o jogo. */
export function initCofreSound(): void {
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

function noise(c: AudioContext, start: number, dur: number, filter: BiquadFilterType, freq: number, gain = 0.5, freqTo?: number) {
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

/** clique metalico curto, como o disco de um cofre */
function click(c: AudioContext, at: number, gain = 0.35) {
  noise(c, at, 0.03, "bandpass", 3200, gain);
  tone(c, 1900, at, 0.03, "square", gain * 0.25);
}

export function playSfx(name: Sfx): void {
  if (typeof window === "undefined" || isMuted()) return;
  const c = ensureCtx();
  if (!c || c.state !== "running" || !master) return;
  // evita empilhar o mesmo som (o flip pode repetir rapido: duas cartas na mesma vez)
  const nowMs = performance.now();
  if (nowMs - (lastPlayed.get(name) ?? 0) < (name === "flip" ? 60 : 120)) return;
  lastPlayed.set(name, nowMs);

  const t = c.currentTime + 0.01;
  try {
    switch (name) {
      case "flip":
        noise(c, t, 0.09, "bandpass", 1800, 0.35, 4200);
        break;
      case "match":
        tone(c, 784, t, 0.1, "triangle", 0.45);
        tone(c, 1175, t + 0.08, 0.18, "triangle", 0.4);
        break;
      case "coringa":
        [784, 988, 1175, 1568].forEach((f, i) => tone(c, f, t + i * 0.06, 0.2, "triangle", 0.4));
        noise(c, t + 0.1, 0.4, "highpass", 5000, 0.18);
        break;
      case "miss":
        tone(c, 220, t, 0.2, "sine", 0.4, 140);
        break;
      case "swap":
        noise(c, t, 0.5, "bandpass", 500, 0.25, 1600);
        break;
      case "yourTurn":
        tone(c, 880, t, 0.09, "sine", 0.35);
        tone(c, 1320, t + 0.08, 0.12, "sine", 0.3);
        break;
      case "tick":
        click(c, t, 0.3);
        break;
      case "timeout":
        tone(c, 440, t, 0.12, "square", 0.14);
        tone(c, 330, t + 0.13, 0.2, "square", 0.14);
        break;
      case "dial":
        [0, 0.07, 0.14].forEach((d) => click(c, t + d, 0.28));
        break;
      case "open":
        [0, 0.06].forEach((d) => click(c, t + d, 0.35));
        tone(c, 180, t + 0.12, 0.35, "triangle", 0.4, 90);
        noise(c, t + 0.12, 0.3, "lowpass", 900, 0.3);
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
