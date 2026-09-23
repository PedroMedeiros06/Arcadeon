/**
 * Simulador multi-cliente da Corrida do Conhecimento.
 * Uso (servidor ja rodando): RACE_URL=http://localhost:3001 npx tsx server/scripts/race-sim.ts
 * Joga partidas completas com N clientes, tenta eventos invalidos e testa desconexoes.
 */
import { io, Socket } from "socket.io-client";

const URL = `${process.env.RACE_URL ?? "http://localhost:3001"}/race`;

interface PlayerState {
  socketId: string;
  name: string;
  distance: number;
  points: number;
  correctCount: number;
  answered: boolean;
  rank: number;
}
interface RoomState {
  code: string;
  hostSocketId: string;
  phase: string;
  questionIndex: number;
  totalQuestions: number;
  phaseStartsAt: number | null;
  phaseEndsAt: number | null;
  serverNow: number;
  endReason: string | null;
  question: { id: string; text: string; options: string[] } | null;
  reveal: { questionId: string; correctIndex: number; entries: { socketId: string; correct: boolean; distanceGained: number; responseMs: number | null }[] } | null;
  players: PlayerState[];
}

let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Client {
  socket: Socket;
  state: RoomState | null = null;
  states: RoomState[] = [];
  events: { name: string; data: unknown }[] = [];
  constructor(public name: string) {
    this.socket = io(URL, { transports: ["websocket"], forceNew: true });
    this.socket.on("room-updated", (s: RoomState) => {
      this.state = s;
      this.states.push(s);
    });
    for (const ev of ["answer-locked", "answer-rejected", "player-answered", "join-error", "room-closed"]) {
      this.socket.on(ev, (data: unknown) => this.events.push({ name: ev, data }));
    }
  }
  get id() {
    return this.socket.id!;
  }
  connected() {
    return new Promise<void>((r) => (this.socket.connected ? r() : this.socket.once("connect", () => r())));
  }
  emit(ev: string, data?: unknown) {
    this.socket.emit(ev, data);
  }
  async waitFor(pred: (s: RoomState) => boolean, timeout = 30000): Promise<RoomState> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.state && pred(this.state)) return this.state;
      await wait(20);
    }
    throw new Error(`${this.name}: timeout aguardando estado (fase atual ${this.state?.phase})`);
  }
  lastEvent(name: string) {
    return [...this.events].reverse().find((e) => e.name === name);
  }
  close() {
    this.socket.disconnect();
  }
}

async function makeRoom(n: number, config: Record<string, unknown> = { questionCount: 5, questionSeconds: 10, maxPlayers: 16 }) {
  const clients = Array.from({ length: n }, (_, i) => new Client(`P${i}`));
  await Promise.all(clients.map((c) => c.connected()));
  clients[0].emit("create-room", { config, name: "P0" });
  const s = await clients[0].waitFor((s) => !!s.code);
  for (const c of clients.slice(1)) {
    c.emit("join-room", { code: s.code, name: c.name });
    await c.waitFor((st) => st.code === s.code);
    await wait(10);
  }
  await clients[0].waitFor((st) => st.players.length === n);
  return { clients, code: s.code };
}

async function scenarioFullGame(n: number) {
  console.log(`\n== partida completa com ${n} jogadores ==`);
  const { clients } = await makeRoom(n);
  clients[0].emit("start-game");
  const cd = await clients[0].waitFor((s) => s.phase === "countdown");
  check(cd.phaseEndsAt! - cd.phaseStartsAt! === 3800, "countdown de 3.8s definido pelo servidor");

  const questionIds: string[][] = clients.map(() => []);
  for (let qi = 0; qi < 5; qi++) {
    const q = await clients[0].waitFor((s) => s.phase === "question" && s.questionIndex === qi);
    await Promise.all(clients.map((c) => c.waitFor((s) => s.phase === "question" && s.questionIndex === qi)));
    clients.forEach((c, i) => questionIds[i].push(c.state!.question!.id));
    check(!("correctIndex" in (q.question as object)) && q.reveal === null, `q${qi}: sem correctIndex/reveal durante a pergunta`);

    // descobre o indice certo sem trapaca: P0 responde 0, os outros esperam — nao da. Entao: todos respondem
    // indices diferentes (i % 4), e o reveal diz quem acertou. Isso ja testa a velocidade: mais rapido = mais distancia.
    const offset = q.serverNow - Date.now();
    await wait(Math.max(0, q.phaseStartsAt! - (Date.now() + offset)) + 30);
    await Promise.all(
      clients.map(async (c, i) => {
        await wait(i * 300);
        c.emit("submit-answer", { questionId: q.question!.id, answerIndex: i % 4 });
      })
    );
    const r = await clients[0].waitFor((s) => s.phase === "question-results" && s.questionIndex === qi);
    const correct = r.reveal!.entries.filter((e) => e.correct);
    check(r.reveal!.entries.length === n, `q${qi}: reveal com ${n} entradas`);
    for (const e of r.reveal!.entries) {
      const idx = clients.findIndex((c) => c.id === e.socketId);
      check(e.correct === (idx % 4 === r.reveal!.correctIndex), `q${qi}: acerto de P${idx} bate com correctIndex`);
      if (!e.correct) check(e.distanceGained === 0, `q${qi}: P${idx} errou e nao andou`);
    }
    if (correct.length >= 2) {
      const sorted = [...correct].sort((a, b) => a.responseMs! - b.responseMs!);
      check(sorted[0].distanceGained >= sorted[sorted.length - 1].distanceGained, `q${qi}: mais rapido anda >= mais lento`);
    }
  }
  const final = await clients[0].waitFor((s) => s.phase === "results");
  check(final.endReason === "completed", "partida terminou como completed");
  check(questionIds.every((ids) => JSON.stringify(ids) === JSON.stringify(questionIds[0])), "todos receberam as mesmas perguntas");
  check(new Set(questionIds[0]).size === 5, "sem pergunta repetida na partida");
  await Promise.all(clients.map((c) => c.waitFor((s) => s.phase === "results")));
  const rankings = clients.map((c) => JSON.stringify(c.state!.players.map((p) => [p.socketId, p.rank])));
  check(rankings.every((r) => r === rankings[0]), "ranking identico pra todos");
  const ranks = final.players.map((p) => p.rank).sort((a, b) => a - b);
  check(JSON.stringify(ranks) === JSON.stringify(final.players.map((_, i) => i + 1)), "ranks unicos 1..N (desempate deterministico)");
  clients.forEach((c) => c.close());
}

async function scenarioAttacks() {
  console.log("\n== ataques / eventos invalidos ==");
  const { clients, code } = await makeRoom(3);
  const [host, p1, p2] = clients;
  const other = await makeRoom(2);

  // nao-host tentando comandar
  p1.emit("start-game");
  await wait(250);
  check(host.state!.phase === "lobby", "nao-host nao inicia partida");
  p1.emit("update-config", { config: { questionCount: 15, questionSeconds: 20, maxPlayers: 16 } });
  await wait(250);
  check(host.state!.config && (host.state as unknown as { config: { questionCount: number } }).config.questionCount === 5, "nao-host nao altera config");

  // host com config absurda: servidor limita
  host.emit("update-config", { config: { questionCount: 999, questionSeconds: -5, maxPlayers: 9999 } });
  await wait(250);
  const cfg = (host.state as unknown as { config: { questionCount: number; questionSeconds: number; maxPlayers: number } }).config;
  check(cfg.questionCount === 10 && cfg.questionSeconds === 15 && cfg.maxPlayers === 16, "config absurda e' sanitizada");
  host.emit("update-config", { config: { questionCount: 5, questionSeconds: 10, maxPlayers: 16 } });
  await wait(250);

  // mandar code de outra sala nao tem efeito: sala vem do socket
  p1.emit("rename-player", { code: other.code, name: "HACK" });
  await wait(250);
  check(!other.clients[0].state!.players.some((p) => p.name === "HACK"), "code de outra sala e' ignorado");

  host.emit("start-game");
  const q = await host.waitFor((s) => s.phase === "question");
  const qid = q.question!.id;

  // antes do startsAt
  p2.emit("submit-answer", { questionId: qid, answerIndex: 0 });
  await wait(200);
  check((p2.lastEvent("answer-rejected")?.data as { reason: string })?.reason === "too-early", "resposta antes do startsAt rejeitada");
  const offset = q.serverNow - Date.now();
  await wait(Math.max(0, q.phaseStartsAt! - (Date.now() + offset)) + 50);

  for (const [payload, label] of [
    [{ questionId: qid, answerIndex: 7 }, "answerIndex 7"],
    [{ questionId: qid, answerIndex: -1 }, "answerIndex -1"],
    [{ questionId: qid, answerIndex: "a" }, "answerIndex string"],
    [{ questionId: qid, answerIndex: null }, "answerIndex null"],
    [{ questionId: qid, answerIndex: 1.5 }, "answerIndex fracionario"],
    [{ questionId: "his-001-fake", answerIndex: 0 }, "questionId inventado"],
    [null, "payload null"],
  ] as const) {
    p1.events = [];
    p1.emit("submit-answer", payload);
    await wait(200);
    check(p1.lastEvent("answer-rejected") !== undefined && p1.lastEvent("answer-locked") === undefined, `rejeita ${label}`);
  }

  // campos extras que o cliente nao deveria mandar sao ignorados
  p1.events = [];
  p1.emit("submit-answer", { questionId: qid, answerIndex: 0, score: 99999, distance: 99999, isCorrect: true, responseTime: 0 });
  await wait(200);
  check(p1.lastEvent("answer-locked") !== undefined, "primeira resposta valida aceita");
  p1.events = [];
  p1.emit("submit-answer", { questionId: qid, answerIndex: 1 });
  await wait(200);
  check((p1.lastEvent("answer-rejected")?.data as { reason: string })?.reason === "duplicate", "segunda resposta rejeitada");

  // spam
  p2.events = [];
  for (let i = 0; i < 100; i++) p2.emit("submit-answer", { questionId: qid, answerIndex: i % 4 });
  await wait(400);
  const locked = p2.events.filter((e) => e.name === "answer-locked").length;
  check(locked === 1, `spam de 100 respostas gera 1 aceita (aceitas=${locked})`);

  const r = await host.waitFor((s) => s.phase === "question-results");
  const e1 = r.reveal!.entries.find((e) => e.socketId === p1.id)!;
  check(e1.distanceGained <= 100 && p1.state!.players.find((p) => p.socketId === p1.id)!.points < 1000, "campos score/distance do cliente ignorados");

  // pergunta antiga na proxima rodada
  const q2 = await host.waitFor((s) => s.phase === "question" && s.questionIndex === 1);
  const off2 = q2.serverNow - Date.now();
  await wait(Math.max(0, q2.phaseStartsAt! - (Date.now() + off2)) + 50);
  p1.events = [];
  p1.emit("submit-answer", { questionId: qid, answerIndex: 0 });
  await wait(200);
  check((p1.lastEvent("answer-rejected")?.data as { reason: string })?.reason === "stale", "resposta pra pergunta antiga rejeitada");

  // resposta depois do tempo: espera o fim (10s + grace) e responde em question-results
  await host.waitFor((s) => s.phase === "question-results" && s.questionIndex === 1, 15000);
  p2.events = [];
  p2.emit("submit-answer", { questionId: q2.question!.id, answerIndex: 0 });
  await wait(200);
  check(p2.lastEvent("answer-rejected") !== undefined, "resposta depois do tempo rejeitada");
  const entries = host.state!.reveal!.entries;
  check(entries.every((e) => e.answerIndex === null || e.socketId === p1.id), "timeout encerrou sem respostas extras");

  // join no meio da partida
  const late = new Client("late");
  await late.connected();
  late.emit("join-room", { code, name: "late" });
  await wait(250);
  check(late.lastEvent("join-error") !== undefined, "entrar com partida em andamento e' bloqueado");

  [...clients, ...other.clients, late].forEach((c) => c.close());
}

async function scenarioDisconnects() {
  console.log("\n== desconexoes ==");
  // jogador que ainda nao respondeu sai -> pergunta encerra se os demais ja responderam
  {
    const { clients } = await makeRoom(3);
    const [host, p1, p2] = clients;
    host.emit("start-game");
    const q = await host.waitFor((s) => s.phase === "question");
    const off = q.serverNow - Date.now();
    await wait(Math.max(0, q.phaseStartsAt! - (Date.now() + off)) + 50);
    host.emit("submit-answer", { questionId: q.question!.id, answerIndex: 0 });
    p1.emit("submit-answer", { questionId: q.question!.id, answerIndex: 1 });
    await wait(200);
    check(host.state!.phase === "question", "ainda esperando P2");
    const t0 = Date.now();
    p2.close();
    await host.waitFor((s) => s.phase === "question-results", 3000);
    check(Date.now() - t0 < 1500, "saida do ultimo pendente encerra pergunta na hora");
    check(!host.state!.players.some((p) => p.socketId === p2.id), "jogador que saiu some da sala");

    // host sai durante a partida -> host passa, jogo continua
    const hostId = host.id;
    host.close();
    await p1.waitFor((s) => s.hostSocketId !== hostId);
    const s = await p1.waitFor((st) => st.phase === "results", 8000);
    check(s.endReason === "players-left", "sobrou 1 jogador -> partida encerra (players-left)");
    p1.close();
  }
  // host sai no lobby
  {
    const { clients } = await makeRoom(3);
    const hostId = clients[0].id;
    clients[0].emit("leave-room");
    const s = await clients[1].waitFor((st) => st.hostSocketId !== hostId);
    check(s.players.length === 2 && s.hostSocketId === clients[1].id, "host saiu no lobby -> proximo vira host");
    // todos saem -> sala fecha
    clients[1].close();
    await wait(200);
    clients[2].emit("leave-room");
    await wait(300);
    const probe = new Client("probe");
    await probe.connected();
    probe.emit("join-room", { code: s.code, name: "probe" });
    await wait(300);
    check(probe.lastEvent("join-error") !== undefined, "sala vazia e' apagada");
    [...clients, probe].forEach((c) => c.close());
  }
}

async function main() {
  const only = process.argv[2];
  if (!only || only === "game") {
    for (const n of [2, 4, 8, 16]) await scenarioFullGame(n);
  }
  if (!only || only === "attacks") await scenarioAttacks();
  if (!only || only === "disconnects") await scenarioDisconnects();
  console.log(failures === 0 ? "\nTUDO OK" : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
