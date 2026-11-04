// Simulacao dos modos: modificadores, times e artista impostor.
const { io } = require("socket.io-client");
// Uso (em server/): PORT=3101 npx tsx src/index.ts  e depois  node scripts/draw-sim-modes.js
const URL = `${process.env.DRAW_URL ?? "http://localhost:3101"}/draw`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? "OK  " : "FAIL"} ${msg}`);
  if (!cond) failures++;
};

function client(name) {
  const s = io(URL, { transports: ["polling"], forceNew: true, reconnection: false });
  const c = { name, s, state: null, events: [], log: [] };
  s.on("room-updated", (st) => (c.state = st));
  s.on("draw-event", (e) => c.events.push(e));
  for (const ev of ["turn-ended", "guess-result", "player-guessed", "player-guess-attempt", "start-error", "chat-message", "chat-blocked", "game-ended"]) {
    s.on(ev, (d) => c.log.push([ev, d]));
  }
  return c;
}
const connected = (c) => new Promise((r) => (c.s.connected ? r() : c.s.once("connect", r)));
const got = (c, ev) => c.log.filter(([e]) => e === ev).map(([, d]) => d);

async function makeRoom(names, config) {
  const cs = names.map(client);
  await Promise.all(cs.map(connected));
  cs[0].s.emit("create-room", { config: { roundsPerPlayer: 1, turnSeconds: 60, visibility: "private", maxPlayers: 8, ...config }, name: names[0] });
  await wait(300);
  for (const c of cs.slice(1)) c.s.emit("join-room", { code: cs[0].state.code, name: c.name });
  await wait(500);
  return cs;
}
const drawerOf = (cs) => cs.find((c) => c.state.drawerId === c.state.myId);

(async () => {
  // ---------- modificadores ----------
  console.log("\n== modificadores ==");
  {
    const cs = await makeRoom(["Ana", "Bia"], { modifiers: ["mono"] });
    cs[0].s.emit("start-game");
    await wait(400);
    const d = drawerOf(cs);
    const g = cs.find((c) => c !== d);
    check(g.state.turnModifier === "mono", "modificador sorteado aparece pra todos na escolha");
    d.s.emit("choose-word", { word: d.state.wordOptions[0].word });
    await wait(300);
    d.s.emit("draw-stroke", { id: "r", points: [{ x: 1, y: 1 }], color: "#ff0000", width: 5 });
    d.s.emit("draw-stroke", { id: "k", points: [{ x: 1, y: 1 }], color: "#000000", width: 5 });
    await wait(300);
    check(g.events.map((e) => e.id).join() === "k", "uma cor: vermelho recusado, preto aceito");
    cs.forEach((c) => c.s.disconnect());
  }
  {
    const cs = await makeRoom(["Ana", "Bia"], { modifiers: ["lightning"], turnSeconds: 90 });
    cs[0].s.emit("start-game");
    await wait(400);
    const d = drawerOf(cs);
    const g = cs.find((c) => c !== d);
    check(d.state.wordOptions[0].maxPoints === 285, `relampago: facil vale ate 285 (${d.state.wordOptions[0].maxPoints})`);
    const word = d.state.wordOptions[0].word;
    d.s.emit("choose-word", { word });
    await wait(300);
    const secs = Math.round((d.state.turnEndsAt - d.state.serverNow) / 1000);
    check(secs <= 30 && secs >= 28, `relampago: turno de 30s (${secs}s)`);
    g.s.emit("submit-guess", { guess: word });
    await wait(400);
    const r = got(g, "guess-result")[0];
    check(r?.correct && r.points > 190, `relampago: acerto vale 1,5x (${r?.points})`);
    cs.forEach((c) => c.s.disconnect());
  }
  {
    const cs = await makeRoom(["Ana", "Bia"], { modifiers: ["noUndo"] });
    cs[0].s.emit("start-game");
    await wait(400);
    const d = drawerOf(cs);
    const g = cs.find((c) => c !== d);
    d.s.emit("choose-word", { word: d.state.wordOptions[0].word });
    await wait(300);
    d.s.emit("draw-stroke", { id: "s", points: [{ x: 1, y: 1 }], color: "#000000", width: 5 });
    d.s.emit("undo-last");
    d.s.emit("clear-canvas", { id: "c" });
    await wait(300);
    check(g.events.length === 1 && !g.log.some(([e]) => e === "event-undone"), "sem desfazer: undo e limpar recusados");
    cs.forEach((c) => c.s.disconnect());
  }

  // ---------- times ----------
  console.log("\n== times ==");
  {
    const cs = await makeRoom(["A1", "B1", "A2", "B2"], { mode: "teams" });
    const teams = cs.map((c) => c.state.players.find((p) => p.id === c.state.myId).team).join("");
    check(teams === "abab", `entrada balanceia os times (${teams})`);
    // tira alguem do B e tenta comecar: precisa de 2 por time
    cs[3].s.emit("set-team", { team: "a" });
    await wait(300);
    cs[0].s.emit("start-game");
    await wait(300);
    check(got(cs[0], "start-error").length === 1, `bloqueia time com 1 jogador: "${got(cs[0], "start-error")[0]?.message}"`);
    cs[0].s.emit("shuffle-teams");
    await wait(300);
    const counts = cs[0].state.players.reduce((m, p) => ((m[p.team] = (m[p.team] ?? 0) + 1), m), {});
    check(counts.a === 2 && counts.b === 2, "embaralhar divide 2x2");
    cs[0].s.emit("start-game");
    await wait(400);
    const order = cs[0].state.turnOrder.map((id) => cs[0].state.players.find((p) => p.id === id).team).join("");
    check(order === "abab", `ordem alterna os times (${order})`);
    const d = drawerOf(cs);
    const myTeam = (c) => c.state.players.find((p) => p.id === c.state.myId).team;
    const mate = cs.find((c) => c !== d && myTeam(c) === myTeam(d));
    const opps = cs.filter((c) => myTeam(c) !== myTeam(d));
    const word = d.state.wordOptions[0].word;
    d.s.emit("choose-word", { word });
    await wait(300);
    opps[0].s.emit("submit-guess", { guess: word });
    await wait(300);
    check(got(opps[0], "guess-result")[0]?.notYourTurn === true, "adversario nao chuta antes da janela de roubo");
    mate.s.emit("submit-guess", { guess: "errado xyz" });
    await wait(300);
    check(got(d, "player-guess-attempt").length === 1 && got(opps[1], "player-guess-attempt").length === 0,
      "chute errado so vai pro proprio time e desenhista");
    await wait(200);
    mate.s.emit("submit-guess", { guess: word });
    await wait(500);
    const ended = got(cs[0], "turn-ended")[0];
    check(ended?.reason === "all-guessed", "turno acaba quando o time do desenhista acerta (adversario nao conta)");
    cs.forEach((c) => c.s.disconnect());
  }
  {
    // roubo: turno curto (30s) e espera a janela final
    const cs = await makeRoom(["A1", "B1", "A2", "B2"], { mode: "teams", turnSeconds: 30 });
    cs[0].s.emit("start-game");
    await wait(400);
    const d = drawerOf(cs);
    const myTeam = (c) => c.state.players.find((p) => p.id === c.state.myId).team;
    const opp = cs.find((c) => myTeam(c) !== myTeam(d));
    const word = d.state.wordOptions[0].word;
    d.s.emit("choose-word", { word });
    console.log("   (esperando 21s pela janela de roubo...)");
    await wait(21000);
    opp.s.emit("submit-guess", { guess: word });
    await wait(500);
    const ended = got(cs[0], "turn-ended")[0];
    check(ended?.reason === "stolen" && ended.stolenBy === opp.state.myId, "adversario rouba na janela final");
    check((got(opp, "guess-result")[0]?.points ?? 0) > 0, `roubo pontua (${got(opp, "guess-result")[0]?.points})`);
    cs.forEach((c) => c.s.disconnect());
  }

  // ---------- impostor ----------
  console.log("\n== artista impostor ==");
  {
    const two = await makeRoom(["X", "Y"], { mode: "impostor" });
    two[0].s.emit("start-game");
    await wait(300);
    check(got(two[0], "start-error").length === 1, "impostor exige 3 jogadores");
    two.forEach((c) => c.s.disconnect());

    const cs = await makeRoom(["Ana", "Bia", "Caio"], { mode: "impostor" });
    cs[0].s.emit("start-game");
    await wait(400);
    const imp = cs.find((c) => c.state.impostor.amImpostor);
    const artists = cs.filter((c) => c !== imp);
    check(cs[0].state.phase === "impostor-drawing", "rodada comeca na fase de tracos");
    check(imp && imp.state.impostor.word === null && artists.every((a) => a.state.impostor.word), "impostor nao ve a palavra, artistas veem");
    check(artists.every((a) => a.state.impostor.impostorId === null), "ninguem sabe quem e o impostor");
    const word = artists[0].state.impostor.word;
    // 6 tracos (2 voltas x 3)
    for (let i = 0; i < 6; i++) {
      const strokerId = cs[0].state.impostor.strokerId;
      const stroker = cs.find((c) => c.state.myId === strokerId);
      const other = cs.find((c) => c !== stroker);
      other.s.emit("draw-stroke", { id: `intruso${i}`, points: [{ x: 5, y: 5 }], color: "#000000", width: 5 });
      stroker.s.emit("draw-stroke", { id: `t${i}`, points: [{ x: i * 10, y: 5 }, { x: i * 10 + 5, y: 50 }], color: "#123456", width: 5 });
      stroker.s.emit("draw-stroke", { id: `t${i}b`, points: [{ x: 1, y: 1 }], color: "#123456", width: 5 });
      await wait(150);
      stroker.s.emit("stroke-done");
      await wait(300);
    }
    const evs = cs[0].events.concat([]);
    const received = cs.find((c) => c !== cs[0]).events;
    check(received.filter((e) => e.id.startsWith("intruso")).length === 0, "so o jogador da vez desenha");
    check(received.filter((e) => e.id.endsWith("b")).length === 0, "1 traco por vez (segundo traco recusado)");
    check(received.every((e) => e.color !== "#123456"), "cor forcada pelo servidor (cor do jogador)");
    check(cs[0].state.phase === "impostor-voting", `depois de 2 voltas vai pra votacao (${cs[0].state.phase})`);
    // chat: artista nao pode digitar a palavra
    artists[0].s.emit("submit-guess", { guess: `acho que e ${word}` });
    await wait(400);
    artists[0].s.emit("submit-guess", { guess: "foi o outro!" });
    await wait(400);
    check(got(artists[0], "chat-blocked").length === 1 && got(imp, "chat-message").length === 1, "chat bloqueia a palavra e passa o resto");
    // todos votam no impostor
    artists.forEach((a) => a.s.emit("cast-vote", { targetId: imp.state.myId }));
    imp.s.emit("cast-vote", { targetId: artists[0].state.myId });
    await wait(500);
    check(cs[0].state.phase === "impostor-guess", "impostor pego vai pro chute final");
    imp.s.emit("submit-guess", { guess: "palavra errada" });
    await wait(500);
    const st = cs[0].state;
    check(st.phase === "impostor-reveal" && st.impostor.caught === true && st.impostor.impostorGuessedRight === false, "revelacao: pego e errou");
    check(st.impostor.impostorId === imp.state.myId && st.impostor.votes.length === 3, "revelacao mostra impostor e votos");
    const scores = Object.fromEntries(st.players.map((p) => [p.id, p.score]));
    check(scores[imp.state.myId] === 0 && artists.every((a) => scores[a.state.myId] === 150), "artistas que votaram certo +150, impostor 0");
    console.log("   (esperando revelacao de 9s...)");
    await wait(9500);
    check(cs[0].state.phase === "results", `1 rodada configurada: vai pro placar (${cs[0].state.phase})`);
    cs.forEach((c) => c.s.disconnect());
  }

  console.log(failures === 0 ? "\nTUDO OK" : `\n${failures} FALHA(S)`);
  process.exit(failures ? 1 : 0);
})();
