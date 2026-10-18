/**
 * Simulador multi-cliente do Cofre.
 * Uso: suba o servidor com timers rapidos e rode o simulador apontando pra ele:
 *   COFRE_FAST_TIMERS=1 PORT=3301 npx tsx src/index.ts
 *   COFRE_URL=http://localhost:3301 npx tsx scripts/cofre-sim.ts [games|rules|timeout|disconnects]
 *
 * Os bots tem memoria perfeita do que ja viram (e acompanham as trocas do tabuleiro movel).
 * Nenhum hook de debug no servidor: tudo e' conferido pelo snapshot publico.
 */
import { io, Socket } from "socket.io-client";

const URL = `${process.env.COFRE_URL ?? "http://localhost:3301"}/cofre`;

interface Cell {
  face: string | null;
  state: "hidden" | "up" | "taken";
}
interface Seat {
  socketId: string;
  name: string;
  points: number;
  pairs: number;
  misses: number;
  left: boolean;
  place: number;
}
interface RoomState {
  code: string;
  hostSocketId: string;
  config: { size: string; maxPlayers: number; turnSeconds: number; movingBoard: boolean; coringa: boolean; peek: boolean };
  phase: string;
  phaseEndsAt: number | null;
  lockedUntil: number;
  serverNow: number;
  endReason: string | null;
  board: { cols: number; rows: number; cells: Cell[]; flipped: number[]; moves: number } | null;
  turnSocketId: string | null;
  swap: { a: number; b: number; seq: number } | null;
  lastEvent: { seq: number; kind: string; by: string } | null;
  lobby: { socketId: string; name: string }[];
  seats: Seat[];
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
  memory = new Map<number, string>();
  lastSwapSeq = 0;
  rejections: string[] = [];
  leaks = 0;
  peekFaces: string[] | null = null;
  /** false = nunca joga sozinho (cenarios manuais) */
  auto = true;
  private playTimer: NodeJS.Timeout | null = null;
  private waitingFor = -1;

  constructor(public name: string) {
    this.socket = io(URL, { transports: ["websocket"], forceNew: true });
    this.socket.on("room-updated", (s: RoomState) => this.onState(s));
    this.socket.on("flip-rejected", (d: { reason: string }) => {
      this.rejections.push(d.reason);
      this.waitingFor = -1;
    });
    this.socket.on("peek", (d: { faces: string[] }) => {
      this.peekFaces = d.faces;
      d.faces.forEach((f, i) => this.memory.set(i, f));
    });
  }

  get id() {
    return this.socket.id ?? "";
  }

  connected() {
    return new Promise<void>((r) => (this.socket.connected ? r() : this.socket.once("connect", () => r())));
  }

  private onState(s: RoomState) {
    const prevSwap = this.state?.swap?.seq ?? 0;
    this.state = s;
    if (s.board) {
      s.board.cells.forEach((c, i) => {
        if (c.state === "hidden" && c.face !== null) this.leaks++;
        if (c.face !== null) this.memory.set(i, c.face);
      });
      if (s.swap && s.swap.seq !== prevSwap && s.swap.seq !== this.lastSwapSeq) {
        this.lastSwapSeq = s.swap.seq;
        const fa = this.memory.get(s.swap.a);
        const fb = this.memory.get(s.swap.b);
        this.memory.delete(s.swap.a);
        this.memory.delete(s.swap.b);
        if (fa !== undefined) this.memory.set(s.swap.b, fa);
        if (fb !== undefined) this.memory.set(s.swap.a, fb);
      }
    }
    if (s.phase === "lobby") {
      this.memory.clear();
      this.lastSwapSeq = 0;
    }
    this.waitingFor = -1;
    this.schedulePlay();
  }

  private schedulePlay() {
    if (this.playTimer) clearTimeout(this.playTimer);
    const s = this.state;
    if (!this.auto || !s || s.phase !== "playing" || s.turnSocketId !== this.id || !s.board) return;
    const wait = Math.max(0, s.lockedUntil - s.serverNow) + 60;
    this.playTimer = setTimeout(() => this.play(), wait);
  }

  /** Escolhe a proxima carta com memoria perfeita. */
  pick(): number | null {
    const s = this.state;
    if (!s?.board) return null;
    const cells = s.board.cells;
    const hidden = cells.flatMap((c, i) => (c.state === "hidden" ? [i] : []));
    if (hidden.length === 0) return null;
    const known = hidden.filter((i) => this.memory.has(i));
    const unknown = hidden.filter((i) => !this.memory.has(i));
    if (s.board.flipped.length === 1) {
      const face = cells[s.board.flipped[0]].face;
      const mate = known.find((i) => this.memory.get(i) === face);
      if (mate !== undefined) return mate;
      return unknown[0] ?? hidden[0];
    }
    for (const i of known) {
      const mate = known.find((j) => j !== i && this.memory.get(j) === this.memory.get(i));
      if (mate !== undefined) return i;
    }
    return unknown[0] ?? hidden[0];
  }

  play() {
    const index = this.pick();
    if (index === null || this.waitingFor === index) return;
    this.waitingFor = index;
    this.socket.emit("flip", { index });
  }

  /** jogada manual: respeita o limite de taxa do servidor (40 ms por virada) */
  async flip(index: number) {
    await sleep(60);
    this.socket.emit("flip", { index });
  }

  close() {
    if (this.playTimer) clearTimeout(this.playTimer);
    this.socket.close();
  }
}

async function until(cond: () => boolean, ms = 20000, label = "condicao"): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(10);
  }
  console.log(`  timeout esperando: ${label}`);
  return false;
}

async function makeRoom(n: number, config: Partial<RoomState["config"]>, auto = true): Promise<Bot[]> {
  const bots = Array.from({ length: n }, (_, i) => new Bot(`Bot${i + 1}`));
  bots.forEach((b) => (b.auto = auto));
  await Promise.all(bots.map((b) => b.connected()));
  bots[0].socket.emit("create-room", { name: bots[0].name, config: { maxPlayers: 8, ...config } });
  await until(() => !!bots[0].state, 3000, "sala criada");
  const code = bots[0].state!.code;
  for (const b of bots.slice(1)) {
    b.socket.emit("join-room", { code, name: b.name });
    await until(() => b.state?.code === code, 3000, "entrar");
  }
  await until(() => bots.every((b) => b.state?.lobby.length === n), 3000, "todos no lobby");
  return bots;
}

const PAIRS: Record<string, number> = { "4x4": 8, "6x4": 12, "6x5": 15, "6x6": 18 };

function expectedPlaces(seats: Seat[]): number[] {
  const better = (x: Seat, y: Seat) =>
    x.points !== y.points ? x.points > y.points : x.pairs !== y.pairs ? x.pairs > y.pairs : x.misses < y.misses;
  return seats.map((p) => (p.left ? 0 : 1 + seats.filter((o) => !o.left && better(o, p)).length));
}

async function scenarioGames() {
  console.log("\n== partidas completas ==");
  const configs: { n: number; config: Partial<RoomState["config"]> }[] = [
    { n: 2, config: { size: "4x4", turnSeconds: 0 } },
    { n: 3, config: { size: "6x4", turnSeconds: 0, coringa: true } },
    { n: 4, config: { size: "6x5", turnSeconds: 0, movingBoard: true } },
    { n: 8, config: { size: "6x6", turnSeconds: 0, movingBoard: true, coringa: true, peek: true } },
    { n: 5, config: { size: "6x4", turnSeconds: 20, peek: true, coringa: true } },
  ];
  for (const { n, config } of configs) {
    console.log(`-- ${n} bots ${JSON.stringify(config)}`);
    const bots = await makeRoom(n, config);
    bots[0].socket.emit("start-game");
    const done = await until(() => bots.every((b) => b.state?.phase === "results"), 60000, "fim da partida");
    check(done, "partida chegou ao fim");
    const s = bots[0].state!;
    check(s.endReason === "finished", `fim por tabuleiro limpo (${s.endReason})`);
    const pairs = PAIRS[s.config.size];
    const totalPairs = s.seats.reduce((a, p) => a + p.pairs, 0);
    const totalPoints = s.seats.reduce((a, p) => a + p.points, 0);
    check(totalPairs === pairs, `pares somam ${pairs} (${totalPairs})`);
    check(totalPoints === pairs + (s.config.coringa ? 2 : 0), `pontos = pares + bonus do coringa (${totalPoints})`);
    check(JSON.stringify(s.seats.map((p) => p.place)) === JSON.stringify(expectedPlaces(s.seats)), "colocacao e desempate");
    check(s.board!.cells.every((c) => c.state === "taken"), "tabuleiro todo levado");
    check(bots.every((b) => b.leaks === 0), "nenhuma face escondida vazou no snapshot");
    if (config.peek) check(bots.every((b) => b.peekFaces?.length === pairs * 2), "espiada chegou pra todos");
    if (config.movingBoard) check((s.swap?.seq ?? 0) > 0 || s.seats.every((p) => p.misses === 0), "tabuleiro movel trocou cartas");
    // revanche volta ao lobby
    bots[0].socket.emit("restart-game");
    check(await until(() => bots.every((b) => b.state?.phase === "lobby"), 3000, "revanche"), "revanche volta ao lobby");
    bots.forEach((b) => b.close());
    await sleep(100);
  }
}

async function scenarioRules() {
  console.log("\n== regras e anti-trapaca ==");
  // espiada ligada: o bot sabe todas as faces e forca um erro de proposito
  const bots = await makeRoom(3, { size: "4x4", turnSeconds: 0, movingBoard: true, peek: true }, false);
  const [a] = bots;
  bots[1].socket.emit("start-game");
  check(bots[1].rejections.length === 0 && (await sleep(200), bots[0].state?.phase === "lobby"), "nao-anfitriao nao inicia");
  a.socket.emit("start-game");
  await until(() => a.state?.phase === "playing", 5000, "jogando");
  const turnId = a.state!.turnSocketId!;
  const turnBot = bots.find((b) => b.id === turnId)!;
  const other = bots.find((b) => b.id !== turnId)!;
  await other.flip(0);
  await until(() => other.rejections.includes("not-your-turn"), 2000, "rejeicao");
  check(other.rejections.includes("not-your-turn"), "fora da vez e rejeitado");
  await turnBot.flip(999);
  await until(() => turnBot.rejections.includes("invalid"), 2000, "invalido");
  check(turnBot.rejections.includes("invalid"), "indice invalido e rejeitado");
  turnBot.rejections = [];

  // forca um erro: vira duas cartas de faces diferentes (descobre pela primeira)
  await turnBot.flip(0);
  await until(() => a.state?.board?.cells[0].state === "up", 2000, "primeira virada");
  const face0 = a.state!.board!.cells[0].face;
  check(face0 !== null, "carta virada mostra a face");
  await turnBot.flip(0);
  await until(() => turnBot.rejections.includes("invalid"), 2000, "mesma carta");
  check(turnBot.rejections.includes("invalid"), "virar a mesma carta duas vezes e rejeitado");
  const wrong = turnBot.peekFaces!.findIndex((f, i) => i !== 0 && f !== face0);
  await turnBot.flip(wrong);
  await until(() => a.state?.lastEvent?.kind === "match" || a.state?.lastEvent?.kind === "miss", 2000, "segunda virada");
  if (a.state!.lastEvent!.kind === "miss") {
    await turnBot.flip(2);
    await until(() => turnBot.rejections.length > 0, 2000, "durante erro");
    check(turnBot.rejections.length > 0, "nao vira terceira carta durante o erro");
    await until(() => a.state?.turnSocketId !== turnId, 3000, "vez passou");
    check(a.state!.turnSocketId !== turnId, "erro passa a vez");
    check(a.state!.board!.cells.filter((c) => c.state === "up").length === 0, "cartas erradas voltaram");
    check((a.state!.swap?.seq ?? 0) === 1, "tabuleiro movel trocou depois do erro");
    const next = bots.find((b) => b.id === a.state!.turnSocketId)!;
    if (a.state!.serverNow < a.state!.lockedUntil) {
      await next.flip(a.state!.board!.cells.findIndex((c) => c.state === "hidden"));
      await until(() => next.rejections.includes("locked"), 1000, "trava");
      check(next.rejections.includes("locked"), "ninguem vira durante a animacao da troca");
    }
  } else {
    console.log("  (primeiro par por sorte; pulando checagem de erro)");
  }
  check(bots.every((b) => b.leaks === 0), "nenhuma face escondida vazou");
  bots.forEach((b) => b.close());
  await sleep(100);
}

async function scenarioTimeout() {
  console.log("\n== tempo de turno ==");
  const bots = await makeRoom(2, { size: "4x4", turnSeconds: 8 }, false);
  bots[0].socket.emit("start-game");
  await until(() => bots[0].state?.phase === "playing", 5000, "jogando");
  const first = bots[0].state!.turnSocketId!;
  const turnBot = bots.find((b) => b.id === first)!;
  check(bots[0].state!.phaseEndsAt !== null, "vez tem relogio");
  await turnBot.flip(0);
  await until(() => bots[0].state?.board?.cells[0].state === "up", 2000, "virou");
  await until(() => bots[0].state?.turnSocketId !== first, 3000, "estourou");
  const s = bots[0].state!;
  check(s.turnSocketId !== first, "tempo esgotado passa a vez");
  check(s.lastEvent?.kind === "timeout", "evento de tempo esgotado");
  check(s.board!.cells[0].state === "hidden", "carta virada volta ao estourar");
  check(s.seats.every((p) => p.misses === 0) && s.board!.moves === 0, "estourar nao conta erro nem jogada");
  bots.forEach((b) => b.close());
  await sleep(100);
}

async function scenarioDisconnects() {
  console.log("\n== saidas no meio ==");
  const bots = await makeRoom(3, { size: "4x4", turnSeconds: 0 }, false);
  bots[0].socket.emit("start-game");
  await until(() => bots[0].state?.phase === "playing", 5000, "jogando");
  const first = bots[0].state!.turnSocketId!;
  const leaver = bots.find((b) => b.id === first)!;
  const stay = bots.filter((b) => b !== leaver);
  await leaver.flip(0);
  await until(() => stay[0].state?.board?.cells[0].state === "up", 2000, "virou");
  leaver.close();
  await until(() => stay[0].state?.seats.some((p) => p.left) ?? false, 3000, "saida");
  const s = stay[0].state!;
  check(s.phase === "playing", "partida continua com 2");
  check(s.turnSocketId !== first && stay.some((b) => b.id === s.turnSocketId), "vez foi pra quem ficou");
  check(s.board!.cells.every((c) => c.state !== "up"), "carta de quem saiu nao ficou virada");
  check(s.seats.find((p) => p.socketId === first)?.place === 0, "quem saiu fica fora da colocacao");
  stay[1].close();
  await until(() => stay[0].state?.phase === "results", 3000, "fim");
  check(stay[0].state!.phase === "results" && stay[0].state!.endReason === "players-left", "sobrou um: fim por abandono");
  stay[0].close();
  await sleep(100);
}

async function main() {
  const which = process.argv[2];
  if (!which || which === "rules") await scenarioRules();
  if (!which || which === "timeout") await scenarioTimeout();
  if (!which || which === "disconnects") await scenarioDisconnects();
  if (!which || which === "games") await scenarioGames();
  console.log(failures === 0 ? "\nTUDO OK" : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
