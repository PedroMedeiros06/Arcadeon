// Simulacao: 3 clientes, F5 do desenhista no meio do turno, queda no lobby, balde/forma, undo.
const { io } = require("socket.io-client");
// Uso (em server/): PORT=3101 npx tsx src/index.ts  e depois  node scripts/draw-sim.js
const URL = `${process.env.DRAW_URL ?? "http://localhost:3101"}/draw`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(cond, msg) {
  console.log(`${cond ? "OK  " : "FAIL"} ${msg}`);
  if (!cond) failures++;
}

function client(name) {
  const s = io(URL, { transports: ["polling"], forceNew: true, reconnection: false });
  const c = { name, s, state: null, session: null, events: [], canvas: null, log: [] };
  s.on("room-updated", (st) => (c.state = st));
  s.on("session", (d) => (c.session = d));
  s.on("draw-event", (e) => c.events.push(e));
  s.on("event-undone", (e) => c.events.push({ undone: e.id }));
  s.on("canvas-sync", (d) => (c.canvas = d.events));
  for (const ev of ["turn-ended", "game-ended", "guess-result", "player-guessed", "player-guess-attempt", "join-error", "session-lost"]) {
    s.on(ev, (d) => c.log.push([ev, d]));
  }
  return c;
}
const connected = (c) => new Promise((r) => (c.s.connected ? r() : c.s.once("connect", r)));
const resume = (c, session) =>
  new Promise((r) => c.s.emit("resume", session, (res) => r(res)));

(async () => {
  const a = client("Ana"), b = client("Bia"), d = client("Duda");
  await Promise.all([connected(a), connected(b), connected(d)]);
  a.s.emit("create-room", { config: { roundsPerPlayer: 1, turnSeconds: 60, visibility: "private", maxPlayers: 8 }, name: "Ana" });
  await wait(300);
  const code = a.state.code;
  check(!!a.session?.token && a.session.code === code, "sessao recebida ao criar");
  b.s.emit("join-room", { code, name: "Bia" });
  d.s.emit("join-room", { code, name: "Duda" });
  await wait(400);
  check(a.state.players.length === 3, "3 jogadores no lobby");
  check(!JSON.stringify(b.state).includes(a.session.token), "token de outro jogador nunca vaza no estado");

  // queda no lobby: Bia cai e volta com socket novo
  const bSession = b.session;
  b.s.disconnect();
  await wait(400);
  check(a.state.players.find((p) => p.name === "Bia")?.connected === false, "Bia aparece desconectada, mas continua na sala");
  const b2 = client("Bia2");
  await connected(b2);
  const r1 = await resume(b2, bSession);
  await wait(300);
  check(r1.ok && b2.state?.code === code && b2.state.myId === bSession.playerId, "Bia retomou o mesmo lugar");
  check(a.state.players.find((p) => p.name === "Bia")?.connected === true, "Bia aparece conectada de novo");
  const bad = await resume(client("hacker"), { ...bSession, token: "x" });
  check(!bad.ok, "resume com token errado e recusado");

  // comeca
  a.s.emit("start-game");
  await wait(400);
  const all = [a, b2, d];
  const drawer = all.find((c) => c.state.drawerId === c.state.myId);
  const guessers = all.filter((c) => c !== drawer);
  check(!!drawer && drawer.state.phase === "picking-word" && drawer.state.wordOptions.length === 3, "desenhista recebe 3 opcoes");
  const cats = new Set(drawer.state.wordOptions.map((w) => w.category));
  check(cats.size === 3, `3 categorias diferentes: ${drawer.state.wordOptions.map((w) => w.word + "/" + w.category).join(", ")}`);
  check(typeof drawer.state.pickEndsAt === "number", "prazo de escolha exposto");
  const word = drawer.state.wordOptions[0].word;
  drawer.s.emit("choose-word", { word });
  await wait(400);
  check(guessers[0].state.phase === "drawing" && guessers[0].state.currentWord === null, "adivinhador nao ve a palavra");

  drawer.s.emit("draw-stroke", { id: "s1", points: [{ x: 10, y: 10 }, { x: 100, y: 100 }], color: "#ff0000", width: 7 });
  drawer.s.emit("draw-stroke", { id: "s1", points: [{ x: 120, y: 90 }], color: "#ff0000", width: 7 });
  drawer.s.emit("draw-fill", { id: "f1", x: 400, y: 300, color: "#00ff00" });
  drawer.s.emit("draw-shape", { id: "r1", shape: "rect", x1: 50, y1: 50, x2: 300, y2: 200, color: "#0000ff", width: 3 });
  drawer.s.emit("draw-shape", { id: "bad", shape: "star", x1: 1, y1: 1, x2: 2, y2: 2, color: "#0000ff", width: 3 });
  drawer.s.emit("draw-fill", { id: "bad2", x: "a", y: 3, color: "red" });
  guessers[0].s.emit("draw-fill", { id: "intruso", x: 10, y: 10, color: "#000000" });
  await wait(400);
  const types = guessers[0].events.map((e) => e.type).join(",");
  check(types === "stroke,stroke,fill,shape", `adivinhador recebeu so eventos validos do desenhista (${types})`);
  drawer.s.emit("undo-last");
  await wait(300);
  check(guessers[0].events.some((e) => e.undone === "r1"), "undo remove a forma");

  // F5 do desenhista: socket novo, retoma e recebe o canvas
  const drawerSession = drawer.session;
  drawer.s.disconnect();
  await wait(300);
  const drawer2 = client("drawer-f5");
  await connected(drawer2);
  const r2 = await resume(drawer2, drawerSession);
  await wait(400);
  check(r2.ok && drawer2.state.phase === "drawing" && drawer2.state.currentWord === word, "desenhista voltou do F5 ainda desenhando, vendo a palavra");
  check(Array.isArray(drawer2.canvas) && drawer2.canvas.map((e) => e.type).join(",") === "stroke,fill", "canvas reconstruido (traco consolidado + balde)");
  check(drawer2.canvas?.[0]?.points?.length === 3, "traco em fragmentos virou um evento so");
  drawer2.s.emit("draw-stroke", { id: "s2", points: [{ x: 1, y: 1 }], color: "#000000", width: 3 });
  await wait(300);
  check(guessers[0].events.some((e) => e.id === "s2"), "desenhista continua desenhando depois do F5");

  // adivinhador faz F5 e chuta
  const gSession = guessers[1].session;
  guessers[1].s.disconnect();
  const g2 = client("guesser-f5");
  await connected(g2);
  await resume(g2, gSession);
  await wait(300);
  check(!!g2.canvas, "adivinhador recebe o canvas ao voltar");
  g2.s.emit("submit-guess", { guess: "palavra errada" });
  await wait(400);
  g2.s.emit("submit-guess", { guess: word });
  guessers[0].s.emit("submit-guess", { guess: word.toUpperCase() });
  await wait(600);
  const ended = a.log.concat(drawer2.log).find(([ev]) => ev === "turn-ended");
  check(!!ended && ended[1].reason === "all-guessed", "turno termina quando todos acertam (inclusive quem deu F5)");
  const g2res = g2.log.filter(([ev]) => ev === "guess-result").map(([, r]) => r.correct);
  check(g2res.join() === "false,true", "chutes contabilizados depois do F5");

  // Duda sai de vez, os outros seguem
  await wait(5500);
  const phase = drawer2.state.phase;
  check(phase === "picking-word", `proximo turno comecou (${phase})`);

  console.log(failures === 0 ? "\nTUDO OK" : `\n${failures} FALHA(S)`);
  process.exit(failures ? 1 : 0);
})();
