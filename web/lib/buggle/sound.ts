// Efeitos sonoros do Buggle sintetizados com Web Audio API (mesma ideia do DrawIt/Corrida): sem
// arquivos, sem lib. Se o navegador bloquear audio, o jogo segue mudo sem erro.

export const BUGGLE_SOUND_MUTED_KEY = "buggleSoundMuted";

export type BuggleSfx =
  | "countdown"
  | "go"
  | "correct"
  | "secret"
  | "wrong"
  | "already"
  | "otherCorrect"
  | "warning"
  | "tick"
  | "roundEnd"
  | "reveal"
  | "secretReveal";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let listening = false;
const lastPlayed = new Map<BuggleSfx, number>();

function isMuted(): boolean {
  try {
    return window.localStorage.getItem(BUGGLE_SOUND_MUTED_KEY) === "1";
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
export function initBuggleSound(): void {
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

/**
 * `level` muda o som conforme o contexto: no "tick" sao os segundos restantes (quanto menos,
 * mais agudo); no "correct"/"reveal" e o tamanho da palavra (palavra maior, som mais cheio).
 */
export function playBuggleSfx(name: BuggleSfx, level = 0): void {
  if (typeof window === "undefined" || isMuted()) return;
  const c = ensureCtx();
  if (!c || c.state !== "running" || !master) return;
  // evita empilhar o mesmo som (varias palavras chegando juntas)
  const nowMs = performance.now();
  if (nowMs - (lastPlayed.get(name) ?? 0) < 90) return;
  lastPlayed.set(name, nowMs);

  const t = c.currentTime + 0.01;
  try {
    switch (name) {
      case "countdown":
        tone(c, 587, t, 0.14, "triangle", 0.45);
        break;
      case "go":
        tone(c, 880, t, 0.3, "triangle", 0.5);
        tone(c, 1175, t, 0.3, "sine", 0.3);
        noise(c, t, 0.25, 900, 0.12, 3000);
        break;
      case "correct": {
        // palavra maior = arpejo mais longo
        const notes = [660, 830, 988, 1175, 1318].slice(0, Math.min(5, Math.max(2, level - 2)));
        notes.forEach((f, i) => tone(c, f, t + i * 0.06, i === notes.length - 1 ? 0.22 : 0.09, "sine", 0.45));
        break;
      }
      case "secret":
        [523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, f, t + i * 0.08, i === 4 ? 0.5 : 0.14, "triangle", 0.45));
        noise(c, t + 0.3, 0.4, 3000, 0.14, 8000);
        break;
      case "wrong":
        tone(c, 220, t, 0.09, "square", 0.16);
        tone(c, 165, t + 0.1, 0.18, "square", 0.16);
        break;
      case "already":
        tone(c, 494, t, 0.08, "sine", 0.3);
        tone(c, 494, t + 0.11, 0.08, "sine", 0.3);
        break;
      case "otherCorrect":
        tone(c, 988, t, 0.06, "sine", 0.22);
        tone(c, 1318, t + 0.05, 0.08, "sine", 0.18);
        break;
      case "warning":
        // alarme curto quando faltam 10s
        [0, 0.18, 0.36].forEach((d) => tone(c, 880, t + d, 0.12, "square", 0.2, 660));
        break;
      case "tick": {
        // relogio: quanto menos segundo sobrando, mais agudo e mais forte
        const remaining = Math.max(0, Math.min(10, level));
        const freq = 700 + (10 - remaining) * 60;
        const gain = 0.14 + (10 - remaining) * 0.015;
        tone(c, freq, t, 0.06, "square", gain);
        noise(c, t, 0.03, 4000, 0.08);
        break;
      }
      case "roundEnd":
        tone(c, 392, t, 0.5, "sawtooth", 0.22, 196);
        tone(c, 311, t, 0.5, "square", 0.12, 155);
        break;
      case "reveal": {
        const freq = 520 + Math.min(10, level) * 45;
        tone(c, freq, t, 0.1, "triangle", 0.35);
        noise(c, t, 0.08, 1800, 0.08, 4000);
        break;
      }
      case "secretReveal":
        [392, 523, 659, 784, 1046].forEach((f, i) => tone(c, f, t + i * 0.12, i === 4 ? 0.8 : 0.2, "triangle", 0.45));
        noise(c, t + 0.5, 0.6, 2500, 0.15, 9000);
        break;
    }
  } catch {
    // audio nunca derruba o jogo
  }
}
