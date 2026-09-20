"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getShopCatalog, getInventory, equipAvatar } from "@/lib/inventory";
import { Avatar } from "@/components/Avatar";
import type { Avatar as AvatarType, UserAvatar } from "@/lib/types";

interface AvatarEditModalProps {
  name: string;
  onNameChange?: (name: string) => void;
  onClose: () => void;
}

export function AvatarEditModal({ name, onNameChange, onClose }: AvatarEditModalProps) {
  const { user, equippedAvatar, refreshProfile } = useAuth();
  const [catalog, setCatalog] = useState<AvatarType[]>([]);
  const [owned, setOwned] = useState<UserAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localName, setLocalName] = useState(name);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [catalogData, ownedData] = await Promise.all([getShopCatalog(), getInventory(user.id)]);
    setCatalog(catalogData);
    setOwned(ownedData);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const ownedIds = new Set(owned.map((o) => o.avatar_id));
  const ownedAvatars = catalog.filter((a) => ownedIds.has(a.id));

  async function handleEquip(avatarId: string) {
    if (!user) return;
    setBusyId(avatarId);
    try {
      await equipAvatar(user.id, avatarId);
      await refreshProfile();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-[var(--border)] px-5 py-4">
          <p className="text-sm font-extrabold uppercase tracking-wide text-[var(--fg-muted)]">
            Editar avatar
          </p>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 px-5 pt-5">
          <span className="block overflow-hidden rounded-2xl">
            <Avatar
              emoji={equippedAvatar?.emoji}
              bgColor={equippedAvatar?.bg_color}
              imageUrl={equippedAvatar?.image_url}
              fallbackLetter={localName.trim().charAt(0).toUpperCase()}
              size="xl"
              shape="square"
            />
          </span>

          {!user && (
            <div className="w-full">
              <label className="mb-1 block text-xs font-bold text-[var(--fg-muted)]">
                Digite seu nome
              </label>
              <input
                value={localName}
                maxLength={10}
                onChange={(e) => {
                  setLocalName(e.target.value);
                  onNameChange?.(e.target.value);
                }}
                className="w-full rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-bold text-[var(--fg)] outline-none focus:border-[var(--primary)]"
              />
              <p className="mt-1 text-[11px] font-medium text-[var(--fg-muted)]">Até 10 letras</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!user ? (
            <p className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] p-4 text-center text-sm font-medium text-[var(--fg-muted)]">
              Entre na sua conta pra escolher um avatar personalizado.
            </p>
          ) : loading ? (
            <p className="text-center text-sm font-medium text-[var(--fg-muted)]">Carregando...</p>
          ) : ownedAvatars.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg)] p-4 text-center text-sm font-medium text-[var(--fg-muted)]">
              Você ainda não tem avatares. Veja a loja no Inventário!
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {ownedAvatars.map((a) => {
                const isEquipped = equippedAvatar?.id === a.id;
                return (
                  <button
                    key={a.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleEquip(a.id)}
                    disabled={busyId === a.id || isEquipped}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition ${
                      isEquipped
                        ? "border-[var(--primary)] bg-[var(--primary-tint)]"
                        : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--primary)]"
                    }`}
                  >
                    <Avatar emoji={a.emoji} bgColor={a.bg_color} imageUrl={a.image_url} size="lg" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t-2 border-[var(--border)] p-4">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="w-full rounded-xl border-2 border-[var(--border-hover)] bg-[var(--fg-muted)] py-3 text-sm font-extrabold text-white transition hover:opacity-90"
          >
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
}
