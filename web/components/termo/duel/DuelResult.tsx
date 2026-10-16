"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { fetchDuelRecord } from "@/lib/termo/duel";
import { boardScores, type DuelPlayer, type DuelState } from "@/lib/termo/duelRules";
import { withAccents } from "@/lib/termo/logic";
import { Confetti } from "../Extras";

const COLOR: Record<string, string> = {
  C: "bg-[var(--termo-correct)] text-white",
  P: "bg-[var(--termo-present)] text-white",
  A: "bg-[var(--fg-muted)] text-white",
};

function reasonText(duel: DuelState, iWon: boolean): string {
  const rival = duel.opponent?.username ?? "seu rival";
  switch (duel.endReason) {
    case "solved":
      return iWon ? "Você acertou primeiro." : `${rival} acertou primeiro.`;
    case "closest":
      return iWon ? "Ninguém acertou, mas você chegou mais perto." : `Ninguém acertou, mas ${rival} chegou mais perto.`;
    case "forfeit":
      return iWon ? `${rival} desistiu.` : "Você desistiu.";
    case "abandoned":
      return iWon ? `${rival} saiu do duelo.` : "Você ficou fora por mais de um minuto.";
    default:
      return "";
  }
}

/** Palpites de um jogador, um tabuleiro por coluna, com letras (o duelo ja acabou). */
function PlayerRows({ player, boardCount, label }: { player: DuelPlayer; boardCount: number; label: string }) {
  const guesses = player.guesses ?? [];
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <div className="flex items-center gap-1.5">
        <Avatar
          emoji={player.avatar.emoji}
          bgColor={player.avatar.bgColor}
          imageUrl={player.avatar.imageUrl}
          fallbackLetter={player.username.charAt(0).toUpperCase()}
          size="sm"
        />
        <span className="max-w-24 truncate text-xs font-extrabold text-[var(--fg)]">{label}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: boardCount }, (_, b) => {
          const rows: { word: string; code: string }[] = [];
          for (let g = 0; g < player.patterns.length; g++) {
            rows.push({ word: guesses[g] ?? "", code: player.patterns[g][b] });
            if (player.patterns[g][b] === "CCCCC") break;
          }
          return (
            <div key={b} className="flex flex-col gap-px">
              {rows.map((r, g) => (
                <div key={g} className="flex gap-px">
                  {r.code.split("").map((c, i) => (
                    <span
                      key={i}
                      className={`flex items-center justify-center rounded-[2px] font-extrabold uppercase ${COLOR[c]} ${
                        boardCount === 4 ? "h-2.5 w-2.5 text-[0px]" : "h-4 w-4 text-[9px]"
                      }`}
                    >
                      {r.word[i]}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DuelResultProps {
  duel: DuelState;
  accents: Record<string, string>;
  busy: boolean;
  onRematch: () => void;
  onExit: () => void;
}

export function DuelResult({ duel, accents, busy, onRematch, onExit }: DuelResultProps) {
  const iWon = duel.winnerId === duel.me.userId;
  const rival = duel.opponent;
  const [record, setRecord] = useState<{ wins: number; losses: number } | null>(null);

  const rivalId = rival?.userId ?? null;
  useEffect(() => {
    if (!rivalId) return;
    let alive = true;
    void fetchDuelRecord(rivalId).then((r) => alive && setRecord(r));
    return () => {
      alive = false;
    };
  }, [rivalId]);

  const myScores = boardScores(duel.me.patterns, duel.boardCount);
  const rivalScores = rival ? boardScores(rival.patterns, duel.boardCount) : [];
  const sum = (s: number[]) => s.reduce((a, b) => a + b, 0);

  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5 text-center animate-[scaleIn_0.25s_ease-out]">
      {iWon && <Confetti />}
      <div className="text-5xl">{iWon ? "🏆" : "😤"}</div>
      <div>
        <h2 className="font-display text-2xl font-extrabold text-[var(--fg)]">{iWon ? "Você venceu!" : "Você perdeu"}</h2>
        <p className="mt-1 text-sm font-semibold text-[var(--fg-muted)]">{reasonText(duel, iWon)}</p>
      </div>

      {duel.endReason === "closest" && rival && (
        <div className="flex gap-3 text-sm font-bold text-[var(--fg-muted)]">
          <span>
            Você <b className="text-[var(--fg)]">{sum(myScores)}</b> pts
          </span>
          <span>·</span>
          <span>
            {rival.username} <b className="text-[var(--fg)]">{sum(rivalScores)}</b> pts
          </span>
        </div>
      )}

      {duel.words && (
        <p className="text-sm font-semibold text-[var(--fg-muted)]">
          {duel.words.length > 1 ? "As palavras eram" : "A palavra era"}{" "}
          <b className="uppercase text-[var(--fg)]">{duel.words.map((w) => withAccents(w, accents)).join(", ")}</b>
        </p>
      )}

      {rival && (
        <div className="flex w-full justify-center gap-4">
          <PlayerRows player={duel.me} boardCount={duel.boardCount} label="Você" />
          <PlayerRows player={rival} boardCount={duel.boardCount} label={rival.username} />
        </div>
      )}

      {record && rival && (
        <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">Placar contra {rival.username}</p>
          <p className="font-display text-xl font-extrabold text-[var(--fg)]">
            {record.wins} <span className="text-[var(--fg-muted)]">x</span> {record.losses}
          </p>
        </div>
      )}

      <div className="flex w-full gap-2">
        <button
          onClick={onExit}
          className="flex-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-extrabold text-[var(--fg)] transition hover:bg-[var(--bg)]"
        >
          Voltar
        </button>
        <button
          onClick={onRematch}
          disabled={busy}
          className="flex-1 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-4 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2 disabled:opacity-50"
        >
          Novo duelo
        </button>
      </div>
    </div>
  );
}
