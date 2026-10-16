"use client";

import { Avatar } from "@/components/Avatar";
import type { DuelPlayer } from "@/lib/termo/duelRules";

const COLOR: Record<string, string> = {
  C: "bg-[var(--termo-correct)]",
  P: "bg-[var(--termo-present)]",
  A: "bg-[var(--fg-muted)]",
};

/** Linhas de um tabuleiro ate a que resolveu (depois dela o tabuleiro para, como no jogo). */
function boardRows(patterns: string[][], board: number): string[] {
  const rows: string[] = [];
  for (const row of patterns) {
    rows.push(row[board]);
    if (row[board] === "CCCCC") break;
  }
  return rows;
}

interface OpponentBoardsProps {
  player: DuelPlayer;
  boardCount: number;
  maxAttempts: number;
  /** "acabou as tentativas" / "sumiu" etc. */
  note?: string | null;
  /** botoes da partida (desistir, reivindicar), no fim da faixa */
  children?: React.ReactNode;
}

/** Progresso do rival: so as cores, em miniatura, um bloquinho por tabuleiro. */
export function OpponentBoards({ player, boardCount, maxAttempts, note, children }: OpponentBoardsProps) {
  const cell = boardCount === 4 ? 5 : boardCount === 2 ? 6 : 8;
  return (
    <div className="flex w-full max-w-xl shrink-0 items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5">
      <Avatar
        emoji={player.avatar.emoji}
        bgColor={player.avatar.bgColor}
        imageUrl={player.avatar.imageUrl}
        fallbackLetter={player.username.charAt(0).toUpperCase()}
        size="sm"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-extrabold text-[var(--fg)]">{player.username}</span>
        <span className="truncate text-[10px] font-bold text-[var(--fg-muted)]">
          {note ?? `${player.patterns.length}/${maxAttempts} tentativas`}
        </span>
      </div>
      <div className="flex shrink-0 gap-1.5" aria-label={`Progresso de ${player.username}`}>
        {Array.from({ length: boardCount }, (_, b) => {
          const rows = boardRows(player.patterns, b);
          const solved = rows[rows.length - 1] === "CCCCC";
          return (
            <div key={b} className={`flex flex-col gap-px rounded-[3px] ${solved ? "ring-2 ring-[var(--termo-correct)]" : ""}`}>
              {Array.from({ length: maxAttempts }, (_, r) => (
                <div key={r} className="flex gap-px">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={`rounded-[1px] ${rows[r] ? COLOR[rows[r][i]] : "bg-[var(--border)]"}`}
                      style={{ width: cell, height: cell }}
                    />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}
