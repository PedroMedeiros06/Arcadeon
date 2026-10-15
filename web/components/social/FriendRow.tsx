import Link from "next/link";
import { LogIn } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { joinHref, presenceText, type Friend } from "@/lib/social/rules";

const DOT = { playing: "bg-[var(--game-termo)]", online: "bg-[var(--game-termo)]", offline: "bg-[var(--border-hover)]" };

/** Amigo com avatar, status e "Entrar" quando ele esta numa sala de jogo em grupo. */
export function FriendRow({
  friend,
  now,
  compact = false,
  hideJoin = false,
  actions,
}: {
  friend: Friend;
  now: number;
  compact?: boolean;
  /** na lista de convite da sala de espera, "Entrar" na sala do amigo nao faz sentido */
  hideJoin?: boolean;
  /** botoes extras a direita (aceitar, remover...) */
  actions?: React.ReactNode;
}) {
  const status = friend.status === "accepted" ? presenceText(friend.presence, now) : null;
  const join = friend.status === "accepted" && !hideJoin ? joinHref(friend.presence, now) : null;

  return (
    <div className="flex items-center gap-3">
      <span className="relative shrink-0">
        <Avatar
          emoji={friend.avatar.emoji}
          bgColor={friend.avatar.bgColor}
          imageUrl={friend.avatar.imageUrl}
          fallbackLetter={friend.username.charAt(0).toUpperCase()}
          size={compact ? "sm" : "md"}
        />
        {status && (
          <span
            aria-hidden
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--card)] ${DOT[status.tone]}`}
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate font-bold text-[var(--fg)] ${compact ? "text-xs" : "text-sm"}`}>{friend.username}</span>
        {status && (
          <span className={`truncate text-[var(--fg-muted)] ${compact ? "text-[0.7rem]" : "text-xs"}`}>{status.label}</span>
        )}
      </div>
      {join && (
        <Link
          href={join}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110 active:scale-[0.98]"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden /> Entrar
        </Link>
      )}
      {actions}
    </div>
  );
}
