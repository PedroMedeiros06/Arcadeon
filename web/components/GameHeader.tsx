import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { getGame } from "@/lib/games";
import { GAME_ICONS } from "./gameIcons";

const buttonBase =
  "flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-sm font-bold transition sm:px-3";

/** Classe dos botoes do header; exportada pra acoes extras (som, tutorial) seguirem o mesmo tamanho. */
export const headerButtonClass = `${buttonBase} border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--bg)]`;

export function GameHeader({
  slug,
  onLeaveRoom,
  actions,
  shortTitle,
}: {
  slug: string;
  onLeaveRoom?: () => void;
  /** botoes extras a direita, antes do "Sair da sala" */
  actions?: React.ReactNode;
  /** titulo menor no celular, ex.: "Corrida" */
  shortTitle?: string;
}) {
  const game = getGame(slug);
  const Icon = GAME_ICONS[slug];

  return (
    <header
      className="sticky top-0 z-40 shrink-0 border-b-2 border-t-4 border-b-[var(--border)] bg-[var(--card)]"
      style={{ borderTopColor: game.accent }}
    >
      <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:px-6">
        <Link href="/" aria-label="Voltar ao hub" className={headerButtonClass}>
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Hub</span>
        </Link>

        <h1 className="flex min-w-0 flex-1 items-center justify-center gap-2 font-display text-base font-extrabold tracking-tight text-[var(--fg)] sm:gap-2.5 sm:text-lg">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white sm:h-9 sm:w-9"
            style={{ backgroundColor: game.accent }}
          >
            {Icon && <Icon className="h-4 w-4 sm:h-5 sm:w-5" />}
          </span>
          {shortTitle ? (
            <>
              <span className="truncate sm:hidden">{shortTitle}</span>
              <span className="hidden truncate sm:inline">{game.title}</span>
            </>
          ) : (
            <span className="truncate">{game.title}</span>
          )}
        </h1>

        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          {actions}
          {onLeaveRoom && (
            <button
              type="button"
              aria-label="Sair da sala"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onLeaveRoom}
              className={`${buttonBase} border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] hover:opacity-80`}
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair da sala</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
