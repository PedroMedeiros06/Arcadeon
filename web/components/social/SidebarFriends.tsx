"use client";

import Link from "next/link";
import { useFriends } from "@/lib/social/FriendsProvider";
import { isOnline, sortFriends } from "@/lib/social/rules";
import { FriendRow } from "./FriendRow";
import { useNow } from "./useNow";

const MAX = 4;

/** Ate 4 amigos online acima do Letrado de hoje. */
export function SidebarFriends() {
  const { available, friends } = useFriends();
  const now = useNow();
  if (!available || friends.length === 0) return null;
  const online = sortFriends(friends, now).filter((f) => isOnline(f.presence, now));

  return (
    <div className="mb-3 flex flex-col gap-2.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-4">
      <p className="text-sm font-extrabold text-[var(--fg)]">Amigos online</p>
      {online.length === 0 ? (
        <p className="text-xs text-[var(--fg-muted)]">Ninguém online agora.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {online.slice(0, MAX).map((f) => (
            <li key={f.friendshipId}>
              <FriendRow friend={f} now={now} compact />
            </li>
          ))}
        </ul>
      )}
      <Link href="/amigos" className="text-xs font-bold text-[var(--primary)] hover:underline">
        {online.length > MAX ? `Ver todos (${online.length})` : "Ver amigos"}
      </Link>
    </div>
  );
}
