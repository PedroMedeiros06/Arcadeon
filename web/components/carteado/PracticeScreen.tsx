"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { COLORS, chooseColor, createGame, flip, type CardColor, type FlipEvent, type GameState } from "@/lib/carteado/engine";
import { describeEvent, type EventTone } from "@/lib/carteado/cards";
import type { PlayerAvatar } from "@/lib/carteado/types";
import { MatchView } from "./MatchView";

/** mesmo ritmo do servidor: carta virando + tempo pra ler */
const LOCK_MS = 1100;
const BOT_THINK_MS = 650;
const FINISH_DELAY_MS = 1600;
const TOAST_MS = 1800;
const ME = 0;
const BOT = 1;
const BOT_AVATAR: PlayerAvatar = { emoji: "🤖", bgColor: "#3a3550", imageUrl: null };

type Toast = { text: string; tone: EventTone; seq: number };

function newGame(): GameState {
  return { ...createGame(2, Math.random), turn: Math.random() < 0.5 ? ME : BOT };
}

export function PracticeScreen({ onExit }: { onExit: () => void }) {
  const { username, equippedAvatar } = useAuth();
  const [game, setGame] = useState<GameState>(newGame);
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fresh, setFresh] = useState<{ mine: boolean; index: number } | null>(null);
  const [done, setDone] = useState(false);
  const myName = username ?? "Você";
  const myAvatar: PlayerAvatar | null = equippedAvatar
    ? { emoji: equippedAvatar.emoji ?? null, bgColor: equippedAvatar.bg_color ?? null, imageUrl: equippedAvatar.image_url ?? null }
    : null;

  function show(ev: FlipEvent | { kind: "color"; color: CardColor }, state: GameState, by: number) {
    if (ev.kind === "invalid") return;
    const t = describeEvent(ev, state.lastCard, by === ME, "Robô");
    if (t) {
      const seq = state.flips * 10 + (ev.kind === "color" ? 1 : 0);
      setToast({ ...t, seq });
      window.setTimeout(() => setToast((cur) => (cur?.seq === seq ? null : cur)), TOAST_MS);
    }
    if (ev.kind === "fill") setFresh({ mine: by === ME, index: ev.value - 1 });
  }

  function doFlip(by: number) {
    const r = flip(game, Math.random);
    if (r.event.kind === "invalid") return;
    setGame(r.state);
    show(r.event, r.state, by);
    setLocked(true);
    window.setTimeout(() => setLocked(false), LOCK_MS);
  }

  function doChoose(by: number, color: CardColor) {
    const next = chooseColor(game, color);
    setGame(next);
    show({ kind: "color", color }, next, by);
  }

  // robo: vira sozinho e escolhe uma cor qualquer (todas tem as mesmas cartas)
  useEffect(() => {
    if (game.finished || locked || game.turn !== BOT) return;
    const id = window.setTimeout(() => {
      if (game.pendingWild) doChoose(BOT, COLORS[Math.floor(Math.random() * COLORS.length)]);
      else doFlip(BOT);
    }, BOT_THINK_MS);
    return () => window.clearTimeout(id);
  });

  useEffect(() => {
    if (!game.finished) return;
    const id = window.setTimeout(() => setDone(true), FINISH_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [game.finished]);

  function restart() {
    setGame(newGame());
    setToast(null);
    setFresh(null);
    setDone(false);
  }

  if (done) {
    const won = game.winner === ME;
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-10 text-center">
        <p className="text-5xl">{won ? "🏆" : "🤖"}</p>
        <h2 className="text-2xl font-black text-[var(--fg)]">{won ? "Cartela completa! Você venceu" : "O robô completou primeiro"}</h2>
        <p className="text-sm text-[var(--fg-muted)]">{game.flips} cartas viradas na partida.</p>
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={restart}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--game-accent)] py-3 font-black text-white transition hover:brightness-110"
          >
            <RotateCcw className="h-4 w-4" /> Jogar de novo
          </button>
          <button type="button" onClick={onExit} className="rounded-2xl border-2 border-[var(--border)] py-3 font-bold text-[var(--fg-muted)] hover:bg-[var(--card)]">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const myTurn = game.turn === ME && !game.finished;
  let status: string;
  if (game.finished) status = game.winner === ME ? "Você completou!" : "O robô completou!";
  else if (myTurn) status = game.pendingWild ? "Escolha a cor" : "Sua vez!";
  else status = "Vez do robô";

  return (
    <MatchView
      me={{ name: myName, avatar: myAvatar, cells: game.players[ME].cells, required: game.players[ME].required }}
      opp={{ name: "Robô", avatar: BOT_AVATAR, cells: game.players[BOT].cells, required: game.players[BOT].required }}
      myTurn={myTurn}
      canFlip={myTurn && !locked && !game.pendingWild}
      choosingColor={myTurn && game.pendingWild && !locked}
      lastCard={game.lastCard}
      flipKey={game.flips}
      drawCount={game.draw.length}
      fresh={fresh}
      status={status}
      toast={toast}
      secondsLeft={null}
      timerFraction={null}
      onFlip={() => doFlip(ME)}
      onChoose={(color) => doChoose(ME, color)}
      onLeave={onExit}
    />
  );
}
