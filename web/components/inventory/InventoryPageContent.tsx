"use client";

import { useEffect, useState, useCallback } from "react";
import { Coins, Check, Trophy, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getShopCatalog, getInventory, purchaseAvatar, equipAvatar } from "@/lib/inventory";
import { Avatar } from "@/components/Avatar";
import type { Avatar as AvatarType, UserAvatar } from "@/lib/types";

type Tab = "mine" | "shop";

export function InventoryPageContent() {
  const { user, coins, equippedAvatar, refreshProfile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");
  const [catalog, setCatalog] = useState<AvatarType[]>([]);
  const [owned, setOwned] = useState<UserAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (authLoading) return null;

  if (!user) {
    return (
      <p className="rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-8 text-center font-medium text-[var(--fg-muted)]">
        Entre na sua conta pra ver seu inventário e a loja.
      </p>
    );
  }

  const ownedIds = new Set(owned.map((o) => o.avatar_id));
  const ownedAvatars = catalog.filter((a) => ownedIds.has(a.id));
  const shopAvatars = catalog.filter((a) => a.price_coins !== null);
  const achievementAvatars = catalog.filter((a) => a.price_coins === null);

  async function handleEquip(avatarId: string) {
    if (!user) return;
    setBusyId(avatarId);
    setError(null);
    try {
      await equipAvatar(user.id, avatarId);
      await refreshProfile();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurchase(avatarId: string) {
    setBusyId(avatarId);
    setError(null);
    try {
      await purchaseAvatar(avatarId);
      await refreshProfile();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="animate-fade-up mb-6 flex items-center justify-between rounded-3xl border-2 border-[var(--border)] bg-gradient-to-br from-[var(--primary-dark)] via-[var(--primary)] to-[var(--primary-2)] px-6 py-5">
        <span className="font-bold text-white/80">Seu saldo</span>
        <span className="flex items-center gap-1.5 text-xl font-extrabold text-white">
          <Coins className="h-5 w-5" /> {coins}
        </span>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab("mine")}
          className={`rounded-2xl border-2 border-[var(--border)] px-4 py-2 text-sm font-extrabold transition-all duration-200 active:scale-95 ${
            tab === "mine"
              ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
              : "bg-[var(--card)] text-[var(--fg-muted)] hover:-translate-y-0.5 hover:bg-[var(--bg)]"
          }`}
        >
          Meus Avatares
        </button>
        <button
          onClick={() => setTab("shop")}
          className={`rounded-2xl border-2 border-[var(--border)] px-4 py-2 text-sm font-extrabold transition-all duration-200 active:scale-95 ${
            tab === "shop"
              ? "border-[var(--primary-dark)] bg-[var(--primary)] text-white"
              : "bg-[var(--card)] text-[var(--fg-muted)] hover:-translate-y-0.5 hover:bg-[var(--bg)]"
          }`}
        >
          Loja
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-center font-medium text-[var(--fg-muted)]">Carregando...</p>
      ) : tab === "mine" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {ownedAvatars.length === 0 && (
            <p className="col-span-full rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] py-10 text-center font-medium text-[var(--fg-muted)]">
              Você ainda não tem nenhum avatar. Veja a loja!
            </p>
          )}
          {ownedAvatars.map((a, i) => {
            const isEquipped = equippedAvatar?.id === a.id;
            return (
              <button
                key={a.id}
                onClick={() => handleEquip(a.id)}
                disabled={busyId === a.id || isEquipped}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`animate-fade-up group flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 ${
                  isEquipped
                    ? "border-[var(--primary)] bg-[var(--primary-tint)]"
                    : "border-[var(--border)] bg-[var(--card)] hover:-translate-y-1 hover:border-[var(--primary)]"
                }`}
              >
                <span className="transition-transform duration-200 group-hover:scale-110">
                  <Avatar emoji={a.emoji} bgColor={a.bg_color} imageUrl={a.image_url} size="lg" />
                </span>
                <span className="text-sm font-bold text-[var(--fg)]">{a.name}</span>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${
                    isEquipped ? "text-[var(--primary)]" : "text-[var(--fg-muted)]"
                  }`}
                >
                  {isEquipped && <Check className="h-3 w-3" />}
                  {isEquipped ? "Equipado" : "Equipar"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shopAvatars.map((a, i) => {
            const isOwned = ownedIds.has(a.id);
            const canAfford = coins >= (a.price_coins ?? 0);
            return (
              <div
                key={a.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className="animate-fade-up flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--primary)]"
              >
                <Avatar emoji={a.emoji} bgColor={a.bg_color} imageUrl={a.image_url} size="lg" />
                <span className="text-sm font-bold text-[var(--fg)]">{a.name}</span>
                {isOwned ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-[var(--fg-muted)]">
                    <Check className="h-3 w-3" /> Já possui
                  </span>
                ) : (
                  <button
                    onClick={() => handlePurchase(a.id)}
                    disabled={!canAfford || busyId === a.id}
                    className="flex items-center gap-1 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Coins className="h-3 w-3" /> {a.price_coins}
                  </button>
                )}
              </div>
            );
          })}
          {achievementAvatars.map((a, i) => {
            const isOwned = ownedIds.has(a.id);
            return (
              <div
                key={a.id}
                style={{ animationDelay: `${(shopAvatars.length + i) * 40}ms` }}
                className="animate-fade-up flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-4 opacity-80"
              >
                <Avatar emoji={a.emoji} bgColor={a.bg_color} imageUrl={a.image_url} size="lg" />
                <span className="text-sm font-bold text-[var(--fg)]">{a.name}</span>
                <span className="flex items-center gap-1 text-xs font-medium text-[var(--fg-muted)]">
                  {isOwned ? (
                    <>
                      <Check className="h-3 w-3" /> Desbloqueado
                    </>
                  ) : (
                    <>
                      <Trophy className="h-3 w-3" /> Conquista
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
