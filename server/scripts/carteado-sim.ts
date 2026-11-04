/**
 * Simulador multi-cliente do Carteado.
 * Uso: suba o servidor com timers rapidos e rode o simulador apontando pra ele:
 *   CARTEADO_FAST_TIMERS=1 PORT=3321 npx tsx src/index.ts
 *   CARTEADO_URL=http://localhost:3321 npx tsx scripts/carteado-sim.ts
 *
 * Tudo e' conferido pelo snapshot publico; nenhum hook de debug no servidor.
 */
import { io, Socket } from "socket.io-client";

const URL = `${process.env.CARTEADO_URL ?? "http://localhost:3321"}/carteado`;
const COLORS = ["verde", "vermelho", "azul", "amarelo"];

interface Seat {
  socketId: string;
  name: string;
  cells: (string | null)[];
  required: string | null;
  left: boolean;
}
interface RoomState {
  code: string;
  hostSocketId: string;
  phase: string;
  lockedUntil: number;
  serverNow: number;
  endReason: string | null;
  table: { drawCount: number; discardCount: number; lastCard: unknown; pendingWild: boolean; flips: number } | null;
  turnSocketId: string | null;
  winnerSocketId: string | null;
  lastEvent: { seq: number; kind: string; by: string; auto?: boolean } | null;
  lobby: { socketId: string; name: string }[];
  seats: Seat[];
  [key: string]: unknown;
}

let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Bot {
  socket: Socket;
  state: RoomState | null = null;
  rejections: string[] = [];
  states: RoomState[] = [];
  constructor(public name: string, public active = true) {
    this.socket = io(URL, { transports: ["websocket"], forceNew: true });
    this.socket.on("room-updated", (s: RoomState) => {
      this.state = s;
      this.states.push(s);
      if (this.active) this.act();
    });
    this.socket.on("action-rejected", (r: { reason: string }) => this.rejections.push(r.reason));
  }
  get id() {
    return this.socket.id ?? "";
  }
  act() {
    const s = this.state;
    if (!s || s.phase !== "playing" || s.turnSocketId !== this.id) return;
    const wait = Math.max(0, s.lockedUntil - s.serverNow) + 20;
    setTimeout(() => {
      if (this.state !== s) return;
      if (s.table?.pendingWild) this.socket.emit("choose-color", { color: COLORS[Math.floor(Math.random() * 4)] });
      else this.socket.emit("flip");
    }, wait);
  }
  close() {
    this.socket.close();
  }
}

async function until(fn: () => boolean, ms = 15000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) return false;
    await sleep(20);
  }
  return true;
}

async function room(turnSeconds: number, activeB = true): Promise<[Bot, Bot]> {
  const a = new Bot("Ana");
  const b = new Bot("Bia", activeB);
  await until(() => !!a.id && !!b.id);
  a.socket.emit("create-room", { name: a.name, config: { turnSeconds } });
  await until(() => !!a.state);
  b.socket.emit("join-room", { code: a.state!.code, name: b.name });
  await until(() => b.state?.lobby.length === 2);
  return [a, b];
}

async function playGames() {
  console.log("partidas completas");
  for (let g = 0; g < 5; g++) {
    const [a, b] = await room(0);
    a.socket.emit("start-game");
    const done = await until(() => a.state?.phase === "results", 30000);
    check(done, `partida ${g + 1} termina`);
    const s = a.state!;
    const winner = s.seats.find((x) => x.socketId === s.winnerSocketId);
    check(!!winner && winner.cells.every((c) => c !== null), `vencedor tem 9 numeros (${s.table?.flips} viradas)`);
    check(!a.states.some((x) => "draw" in (x.table ?? {})), "monte nunca sai no snapshot");
    // cartela so cresce
    let ok = true;
    for (const seat of [0, 1]) {
      let prev = 0;
      for (const st of a.states) {
        const n = st.seats[seat]?.cells.filter((c) => c).length ?? 0;
        if (st.phase === "lobby") prev = 0;
        else if (n < prev) ok = false;
        else prev = n;
      }
    }
    check(ok, "cartelas nunca perdem numero");
    check(a.rejections.length + b.rejections.length === 0, "nenhuma acao recusada");
    a.close();
    b.close();
  }
}

async function rules() {
  console.log("regras do servidor");
  const [a, b] = await room(0, false);
  a.active = false;
  a.socket.emit("start-game");
  await until(() => a.state?.phase === "playing");
  const turn = a.state!.turnSocketId;
  const notTurn = turn === a.id ? b : a;
  notTurn.socket.emit("flip");
  await until(() => notTurn.rejections.length > 0, 2000);
  check(notTurn.rejections[0] === "not-your-turn", "fora da vez e' recusado");
  const onTurn = turn === a.id ? a : b;
  onTurn.socket.emit("choose-color", { color: "verde" });
  await until(() => onTurn.rejections.length > 0 || onTurn.state!.lastEvent !== null, 2000);
  check(onTurn.rejections.length > 0 || a.state!.lastEvent?.kind === "color", "escolher cor sem preta e' recusado");
  a.close();
  b.close();
}

async function timeout() {
  console.log("tempo esgotado joga pelo jogador");
  const [a, b] = await room(10, false);
  a.active = false;
  a.socket.emit("start-game");
  const auto = await until(() => !!a.states.find((s) => s.lastEvent?.auto), 5000);
  check(auto, "servidor virou sozinho");
  a.close();
  b.close();
}

async function disconnect() {
  console.log("desconexao no meio");
  const [a, b] = await room(0, false);
  a.socket.emit("start-game");
  await until(() => a.state?.phase === "playing");
  b.close();
  const ended = await until(() => a.state?.phase === "results");
  check(ended && a.state!.endReason === "players-left" && a.state!.winnerSocketId === a.id, "quem fica vence");
  a.close();
}

(async () => {
  await playGames();
  await rules();
  await timeout();
  await disconnect();
  console.log(failures === 0 ? "TUDO OK" : `${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
