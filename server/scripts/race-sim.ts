/**
 * Simulador multi-cliente da Corrida do Conhecimento.
 * Uso: suba o servidor com timers rapidos e rode o simulador apontando pra ele:
 *   RACE_FAST_TIMERS=1 PORT=3099 npx tsx src/index.ts
 *   RACE_URL=http://localhost:3099 npx tsx scripts/race-sim.ts [game|rules|finish|limit|attacks|disconnects]
 *
 * O simulador sabe a alternativa certa importando o banco de perguntas e comparando o texto
 * das opcoes (que chegam embaralhadas) — nenhum hook de debug no servidor.
 */
import { io, Socket } from "socket.io-client";
import { RACE_QUESTIONS } from "../src/raceQuestions";

const URL = `${process.env.RACE_URL ?? "http://localhost:3001"}/race`;

interface PlayerState {
  socketId: string;
  name: string;
  distance: number;
  points: number;
  correctCount: number;
  answered: boolean;
  rank: number;
  streak: number;
  maxStreak: number;
  frozen: boolean;
}
interface RevealEntry {
  socketId: string;
  answerIndex: number | null;
  correct: boolean;
  distanceGained: number;
  responseMs: number | null;
  wasFrozen: boolean;
  streakAfter: number;
  lostStreak: boolean;
  froze: boolean;
}
interface RoomState {
  code: string;
  hostSocketId: string;
  config: { questionSeconds: number; maxPlayers: number };
  phase: string;
  questionIndex: number;
  phaseStartsAt: number | null;
  phaseEndsAt: number | null;
  serverNow: number;
  finishProgress: number;
  finishing: boolean;
  winnerSocketId: string | null;
  endReason: string | null;
  question: { id: string; text: string; options: string[] } | null;
  reveal: { questionId: string; correctIndex: number; entries: RevealEntry[] } | null;
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

function correctIndexOf(q: { id: string; options: string[] }): number {
  const original = RACE_QUESTIONS.find((x) => x.id === q.id);
  if (!original) throw new Error(`pergunta ${q.id} nao esta no banco`);
  return q.options.indexOf(original.options[original.correctIndex]);
}

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
  me(s: RoomState | null = this.state) {
    return s?.players.find((p) => p.socketId === this.id);
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
      await wait(15);
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

async function makeRoom(n: number, config: Record<string, unknown> = { questionSeconds: 10, maxPlayers: 16 }) {
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

/** Espera o inicio da pergunta qi e o fim do lead (quando respostas passam a valer). */
async function waitQuestionOpen(c: Client, qi: number, timeout = 30000) {
  const q = await c.waitFor((s) => (s.phase === "question" && s.questionIndex === qi) || s.phase === "results", timeout);
  if (q.phase === "results") return null;
  const offset = q.serverNow - Date.now();
  await wait(Math.max(0, q.phaseStartsAt! - (Date.now() + offset)) + 30);
  return q;
}

type Plan = "right" | "wrong" | "skip";

/** Joga uma rodada: cada cliente segue seu plano. Retorna o reveal. */
async function playRound(clients: Client[], qi: number, plans: Plan[], delayMs = 0) {
  const q = await waitQuestionOpen(clients[0], qi);
  if (!q) return null;
  const right = correctIndexOf(q.question!);
  await Promise.all(
    clients.map(async (c, i) => {
      if (plans[i] === "skip") return;
      await wait(delayMs * i);
      c.emit("submit-answer", { questionId: q.question!.id, answerIndex: plans[i] === "right" ? right : (right + 1) % 4 });
    })
  );
  const r = await clients[0].waitFor((s) => (s.phase === "question-results" && s.questionIndex === qi) || s.phase === "results", 20000);
  return r;
}

function entryOf(r: RoomState, c: Client) {
  return r.reveal!.entries.find((e) => e.socketId === c.id)!;
}

// ---------- cenarios ----------

async function scenarioFullGame(n: number) {
  console.log(`\n== corrida completa com ${n} jogadores ==`);
  const { clients } = await makeRoom(n);
  clients[0].emit("start-game");
  const cd = await clients[0].waitFor((s) => s.phase === "countdown");
  check(cd.phaseEndsAt! > cd.phaseStartsAt!, "countdown com fim definido pelo servidor");

  const questionIds: string[][] = clients.map(() => []);
  let qi = 0;
  // cada jogador acerta com chance diferente; P0 sempre acerta (garante chegada)
  while (true) {
    const q = await waitQuestionOpen(clients[0], qi);
    if (!q) break;
    await Promise.all(clients.map((c) => c.waitFor((s) => s.phase === "question" && s.questionIndex === qi)));
    clients.forEach((c, i) => questionIds[i].push(c.state!.question!.id));
    check(!("correctIndex" in (q.question as object)) && q.reveal === null, `q${qi}: sem correctIndex/reveal durante a pergunta`);
    const right = correctIndexOf(q.question!);
    await Promise.all(
      clients.map(async (c, i) => {
        await wait(i * 120);
        const hit = i === 0 || (qi + i) % 3 !== 0;
        c.emit("submit-answer", { questionId: q.question!.id, answerIndex: hit ? right : (right + 1) % 4 });
      })
    );
    const r = await clients[0].waitFor((s) => s.phase === "question-results" && s.questionIndex === qi);
    check(r.reveal!.entries.length === n, `q${qi}: reveal com ${n} entradas`);
    qi++;
    if (qi > 40) break;
  }
  const final = await clients[0].waitFor((s) => s.phase === "results");
  check(final.endReason === "finished", "corrida terminou na linha de chegada");
  check(final.winnerSocketId === clients[0].id, "P0 (acertou tudo) venceu");
  check(questionIds.every((ids) => JSON.stringify(ids) === JSON.stringify(questionIds[0])), "todos receberam as mesmas perguntas");
  check(new Set(questionIds[0]).size === questionIds[0].length, "sem pergunta repetida na partida");
  await Promise.all(clients.map((c) => c.waitFor((s) => s.phase === "results")));
  const rankings = clients.map((c) => JSON.stringify(c.state!.players.map((p) => [p.socketId, p.rank])));
  check(rankings.every((r) => r === rankings[0]), "ranking identico pra todos");
  check(new Set(clients.map((c) => c.state!.winnerSocketId)).size === 1, "vencedor identico pra todos");
  const ranks = final.players.map((p) => p.rank).sort((a, b) => a - b);
  check(JSON.stringify(ranks) === JSON.stringify(final.players.map((_, i) => i + 1)), "ranks unicos 1..N (desempate deterministico)");
  clients.forEach((c) => c.close());
}

async function scenarioRules() {
  console.log("\n== sequencia / congelamento ==");
  const { clients } = await makeRoom(2);
  const [a, b] = clients;
  a.emit("start-game");
  // B sempre erra rapido (sequencia 0 -> nunca congela) pra rodada fechar logo e ninguem cruzar
  const W: Plan = "wrong";

  let r = (await playRound(clients, 0, ["right", W]))!;
  let e = entryOf(r, a);
  check(e.correct && e.streakAfter === 1 && e.distanceGained >= 60 && e.distanceGained <= 90, `acerto 1 -> 🔥1, avanco sem bonus (${e.distanceGained})`);
  check(a.me(r)!.streak === 1 && !a.me(r)!.frozen, "snapshot: streak 1, nao congelado");
  const eb = entryOf(r, b);
  check(!eb.correct && !eb.froze && eb.streakAfter === 0 && !b.me(r)!.frozen, "erro sem sequencia nao congela");

  r = (await playRound(clients, 1, ["right", W]))!;
  e = entryOf(r, a);
  check(e.streakAfter === 2 && e.distanceGained >= 65 && e.distanceGained <= 95, `acerto 2 -> 🔥2, bonus +5 (${e.distanceGained})`);

  r = (await playRound(clients, 2, ["right", W]))!;
  e = entryOf(r, a);
  check(e.streakAfter === 3 && e.distanceGained >= 70 && e.distanceGained <= 100, `acerto 3 -> 🔥3, bonus +10 (${e.distanceGained})`);
  check(a.me(r)!.maxStreak === 3, "maxStreak 3");

  r = (await playRound(clients, 3, ["wrong", W]))!;
  e = entryOf(r, a);
  const distBeforeFreeze = a.me(r)!.distance;
  check(e.lostStreak && e.froze && e.streakAfter === 0 && e.distanceGained === 0, "erro com 🔥3 -> perde sequencia e congela");
  check(a.me(r)!.frozen, "snapshot do reveal: congelado (gelo aparece)");

  const q4 = await a.waitFor((s) => s.phase === "question" && s.questionIndex === 4);
  check(a.me(q4)!.frozen, "rodada seguinte: frozen = true durante a pergunta");
  r = (await playRound(clients, 4, ["right", W]))!;
  e = entryOf(r, a);
  check(e.wasFrozen && e.correct && e.distanceGained === 0, "congelado acerta -> avanco 0");
  check(e.streakAfter === 0, "acertar congelado nao inicia sequencia");
  check(a.me(r)!.distance === distBeforeFreeze, "progresso nao mudou na rodada congelada");
  check(!a.me(r)!.frozen, "fim da rodada congelada: frozen = false");

  r = (await playRound(clients, 5, ["right", W]))!;
  e = entryOf(r, a);
  check(!e.wasFrozen && e.streakAfter === 1 && e.distanceGained >= 60, "depois do gelo: acerto volta a andar, 🔥1");

  r = (await playRound(clients, 6, ["wrong", W]))!;
  check(entryOf(r, a).froze, "erro com 🔥1 congela");
  r = (await playRound(clients, 7, ["wrong", W]))!;
  e = entryOf(r, a);
  check(e.wasFrozen && !e.froze && !a.me(r)!.frozen, "errar congelado (sequencia 0) nao congela de novo");

  r = (await playRound(clients, 8, ["wrong", W]))!;
  check(!entryOf(r, a).froze, "erro com sequencia 0 nao congela");

  r = (await playRound(clients, 9, ["right", W]))!;
  check(entryOf(r, a).streakAfter === 1, "acerto -> 🔥1");
  // timeout (nao responder) com sequencia: tem que congelar tambem
  r = (await playRound(clients, 10, ["skip", W], 0))!;
  e = entryOf(r, a);
  check(e.answerIndex === null && e.lostStreak && e.froze, "nao responder com 🔥1 -> perde sequencia e congela");

  clients.forEach((c) => c.close());
}

async function scenarioFinish() {
  console.log("\n== linha de chegada ==");
  const { clients } = await makeRoom(3);
  const [a] = clients;
  a.emit("start-game");
  let qi = 0;
  let finishingSeen = false;
  while (qi < 40) {
    // A acerta tudo, B erra tudo, C acerta so as pares (nao empata com A)
    const r = await playRound(clients, qi, ["right", "wrong", qi % 2 === 0 ? "right" : "wrong"], 0);
    if (!r || r.phase === "results") break;
    if (r.finishing) {
      finishingSeen = true;
      check(a.me(r)!.distance >= r.finishProgress, `reveal final: A cruzou (${a.me(r)!.distance})`);
      break;
    }
    qi++;
  }
  check(finishingSeen, "reveal da rodada de chegada foi exibido (finishing)");
  const lastQi = a.state!.questionIndex;
  const finals = await Promise.all(clients.map((cl) => cl.waitFor((s) => s.phase === "results", 10000)));
  check(finals.every((s) => s.endReason === "finished"), "todos recebem resultado final (finished)");
  const winners = new Set(finals.map((s) => s.winnerSocketId));
  check(winners.size === 1 && finals[0].winnerSocketId !== null, "mesmo vencedor pra todos");
  const w = finals[0].players.find((p) => p.socketId === finals[0].winnerSocketId)!;
  check(w.distance >= 1000 && w.rank === 1, "vencedor cruzou 1000 e e' o 1º");
  await wait(1500);
  const extraQuestion = clients.some((cl) => cl.states.some((s) => s.phase === "question" && s.questionIndex > lastQi));
  check(!extraQuestion, "nenhuma pergunta nova depois da chegada");
  check(clients.every((cl) => cl.state!.phase === "results"), "ninguem saiu de results sozinho");
  clients.forEach((cl) => cl.close());
}

async function scenarioLimit() {
  console.log("\n== failsafe de 30 perguntas ==");
  const { clients } = await makeRoom(2);
  clients[0].emit("start-game");
  let qi = 0;
  while (qi < 35) {
    const r = await playRound(clients, qi, ["wrong", "wrong"]);
    if (!r || r.phase === "results") break;
    qi++;
  }
  const final = await clients[0].waitFor((s) => s.phase === "results", 10000);
  check(final.endReason === "limit", "ninguem chegou -> termina por limite");
  check(final.questionIndex === 29 && qi === 30, `exatamente 30 perguntas (ultima index ${final.questionIndex})`);
  check(final.winnerSocketId !== null, "vencedor definido por progresso/desempate");
  clients.forEach((c) => c.close());
}

async function scenarioAttacks() {
  console.log("\n== ataques / eventos invalidos ==");
  const { clients, code } = await makeRoom(3);
  const [host, p1, p2] = clients;
  const other = await makeRoom(2);

  p1.emit("start-game");
  await wait(250);
  check(host.state!.phase === "lobby", "nao-host nao inicia partida");
  p1.emit("update-config", { config: { questionSeconds: 20, maxPlayers: 16 } });
  await wait(250);
  check(host.state!.config.questionSeconds === 10, "nao-host nao altera config");

  host.emit("update-config", { config: { questionCount: 999, questionSeconds: -5, maxPlayers: 9999 } });
  await wait(250);
  check(host.state!.config.questionSeconds === 15 && host.state!.config.maxPlayers === 16, "config absurda e' sanitizada");
  host.emit("update-config", { config: { questionSeconds: 10, maxPlayers: 16 } });
  await wait(250);

  p1.emit("rename-player", { code: other.code, name: "HACK" });
  await wait(250);
  check(!other.clients[0].state!.players.some((p) => p.name === "HACK"), "code de outra sala e' ignorado");

  host.emit("start-game");
  const q = await host.waitFor((s) => s.phase === "question");
  const qid = q.question!.id;

  p2.emit("submit-answer", { questionId: qid, answerIndex: 0 });
  await wait(100);
  const early = (p2.lastEvent("answer-rejected")?.data as { reason: string })?.reason;
  check(early === "too-early", `resposta antes do startsAt rejeitada (${early})`);
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

  // campos que o cliente nunca pode definir: ignorados
  const right = correctIndexOf(q.question!);
  p1.events = [];
  p1.emit("submit-answer", {
    questionId: qid,
    answerIndex: (right + 1) % 4,
    score: 99999,
    distance: 99999,
    progress: 1000,
    streak: 99,
    maxStreak: 99,
    frozen: false,
    winner: p1.id,
    isCorrect: true,
    responseTime: 0,
  });
  for (const ev of ["set-streak", "finish", "unfreeze", "set-progress"]) p1.emit(ev, { streak: 99, progress: 1000, frozen: false });
  await wait(200);
  check(p1.lastEvent("answer-locked") !== undefined, "primeira resposta valida aceita");
  p1.events = [];
  p1.emit("submit-answer", { questionId: qid, answerIndex: right });
  await wait(200);
  check((p1.lastEvent("answer-rejected")?.data as { reason: string })?.reason === "duplicate", "segunda resposta rejeitada");

  p2.events = [];
  for (let i = 0; i < 100; i++) p2.emit("submit-answer", { questionId: qid, answerIndex: i % 4 });
  await wait(400);
  const locked = p2.events.filter((e) => e.name === "answer-locked").length;
  check(locked === 1, `spam de 100 respostas gera 1 aceita (aceitas=${locked})`);

  const r = await host.waitFor((s) => s.phase === "question-results");
  const e1 = r.reveal!.entries.find((e) => e.socketId === p1.id)!;
  const me1 = r.players.find((p) => p.socketId === p1.id)!;
  check(!e1.correct && e1.distanceGained === 0, "resposta errada com isCorrect/distance forjados nao anda");
  check(me1.streak === 0 && me1.maxStreak === 0 && me1.distance === 0 && me1.points === 0, "streak/progress/score forjados ignorados");
  check(r.winnerSocketId === null && r.phase === "question-results", "winner forjado ignorado");

  const q2 = await host.waitFor((s) => s.phase === "question" && s.questionIndex === 1);
  const off2 = q2.serverNow - Date.now();
  await wait(Math.max(0, q2.phaseStartsAt! - (Date.now() + off2)) + 50);
  p1.events = [];
  p1.emit("submit-answer", { questionId: qid, answerIndex: 0 });
  await wait(200);
  check((p1.lastEvent("answer-rejected")?.data as { reason: string })?.reason === "stale", "resposta pra pergunta antiga rejeitada");

  await host.waitFor((s) => s.phase === "question-results" && s.questionIndex === 1, 15000);
  p2.events = [];
  p2.emit("submit-answer", { questionId: q2.question!.id, answerIndex: 0 });
  await wait(200);
  check(p2.lastEvent("answer-rejected") !== undefined, "resposta depois do tempo rejeitada");

  const late = new Client("late");
  await late.connected();
  late.emit("join-room", { code, name: "late" });
  await wait(250);
  check(late.lastEvent("join-error") !== undefined, "entrar com partida em andamento e' bloqueado");

  [...clients, ...other.clients, late].forEach((c) => c.close());
}

async function scenarioDisconnects() {
  console.log("\n== desconexoes ==");
  {
    const { clients } = await makeRoom(3);
    const [host, p1, p2] = clients;
    host.emit("start-game");
    const q = await waitQuestionOpen(host, 0);
    host.emit("submit-answer", { questionId: q!.question!.id, answerIndex: 0 });
    p1.emit("submit-answer", { questionId: q!.question!.id, answerIndex: 1 });
    await wait(200);
    check(host.state!.phase === "question", "ainda esperando P2");
    const t0 = Date.now();
    p2.close();
    await host.waitFor((s) => s.phase === "question-results", 3000);
    check(Date.now() - t0 < 1500, "saida do ultimo pendente encerra pergunta na hora");
    check(!host.state!.players.some((p) => p.socketId === p2.id), "jogador que saiu some da sala");

    const hostId = host.id;
    host.close();
    await p1.waitFor((s) => s.hostSocketId !== hostId);
    const s = await p1.waitFor((st) => st.phase === "results", 8000);
    check(s.endReason === "players-left" && s.winnerSocketId === p1.id, "sobrou 1 jogador -> partida encerra (players-left)");
    p1.close();
  }
  {
    const { clients } = await makeRoom(3);
    const hostId = clients[0].id;
    clients[0].emit("leave-room");
    const s = await clients[1].waitFor((st) => st.hostSocketId !== hostId);
    check(s.players.length === 2 && s.hostSocketId === clients[1].id, "host saiu no lobby -> proximo vira host");
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
  const run = (name: string) => !only || only === name;
  if (run("rules")) await scenarioRules();
  if (run("finish")) await scenarioFinish();
  if (run("limit")) await scenarioLimit();
  if (run("attacks")) await scenarioAttacks();
  if (run("disconnects")) await scenarioDisconnects();
  if (run("game")) for (const n of [2, 4, 8, 16]) await scenarioFullGame(n);
  console.log(failures === 0 ? "\nTUDO OK" : `\n${failures} FALHA(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
