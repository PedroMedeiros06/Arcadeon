"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Coins, Gamepad2, Lock, Trophy, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { equipAvatar, getInventory, getShopCatalog, purchaseAvatar } from "@/lib/inventory";
import { Avatar } from "@/components/Avatar";
import { LoginModal } from "@/components/LoginModal";
import type { Avatar as AvatarType } from "@/lib/types";
import { ShieldShopCard } from "@/components/termo/ShieldShopCard";

interface Purchase {
  avatar: AvatarType;
}

function PriceTag({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1 tabular-nums">
      <Coins className="h-3.5 w-3.5" /> {value}
    </span>
  );
}

export function ShopPageContent() {
  const { user, coins, equippedAvatar, refreshProfile, loading: authLoading } = useAuth();
  const [catalog, setCatalog] = useState<AvatarType[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPurchase, setLastPurchase] = useState<Purchase | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, inventory] = await Promise.all([getShopCatalog(), user ? getInventory(user.id) : Promise.resolve([])]);
      setCatalog(items);
      setOwnedIds(new Set(inventory.map((i) => i.avatar_id)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function handleBuy(avatar: AvatarType) {
    setBusyId(avatar.id);
    setError(null);
    try {
      await purchaseAvatar(avatar.id);
      await Promise.all([refreshProfile(), load()]);
      setLastPurchase({ avatar });
      setConfirmId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleEquip(avatar: AvatarType) {
    if (!user) return;
    setBusyId(avatar.id);
    try {
      await equipAvatar(user.id, avatar.id);
      await refreshProfile();
      setLastPurchase(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const forSale = catalog.filter((a) => a.price_coins !== null);
  const byAchievement = catalog.filter((a) => a.price_coins === null);

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] px-5 py-4">
        <div>
          <p className="text-xs font-medium text-[var(--fg-muted)]">Seu saldo</p>
          <p className="flex items-center gap-2 font-display text-2xl font-extrabold tabular-nums text-[var(--fg)]">
            <Coins className="h-5 w-5 text-[var(--primary)]" /> {user ? coins : "—"}
          </p>
        </div>
        <p className="max-w-xs text-sm text-[var(--fg-muted)]">
          Ganhe moedas vencendo o Letrado diário. Cada modo vale 10 moedas por dia (15 no modo difícil).
        </p>
      </div>

      {lastPurchase && (
        <div
          role="status"
          className="animate-fade-up flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[var(--primary)] bg-[var(--primary-tint)] px-4 py-3"
        >
          <Avatar
            emoji={lastPurchase.avatar.emoji}
            bgColor={lastPurchase.avatar.bg_color}
            imageUrl={lastPurchase.avatar.image_url}
            size="md"
          />
          <p className="flex-1 text-sm font-semibold text-[var(--fg)]">
            {lastPurchase.avatar.name} foi pro seu inventário.
          </p>
          <button
            type="button"
            onClick={() => handleEquip(lastPurchase.avatar)}
            disabled={busyId === lastPurchase.avatar.id}
            className="rounded-xl bg-[var(--primary)] px-3 py-1.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            Equipar agora
          </button>
          <button
            type="button"
            onClick={() => setLastPurchase(null)}
            aria-label="Fechar aviso"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-2xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      )}

      <ShieldShopCard />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-[var(--fg)]">Avatares</h2>
        {loading ? (
          <p className="py-10 text-center text-sm text-[var(--fg-muted)]">Carregando...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {forSale.map((a, i) => {
              const price = a.price_coins ?? 0;
              const isOwned = ownedIds.has(a.id);
              const isEquipped = equippedAvatar?.id === a.id;
              const missing = price - coins;
              const confirming = confirmId === a.id;
              return (
                <div
                  key={a.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`animate-fade-up flex flex-col items-center gap-2 rounded-2xl border-2 bg-[var(--card)] p-4 text-center transition-all duration-200 ${
                    confirming ? "border-[var(--primary)]" : "border-[var(--border)]"
                  }`}
                >
                  <Avatar emoji={a.emoji} bgColor={a.bg_color} imageUrl={a.image_url} size="lg" />
                  <span className="text-sm font-bold text-[var(--fg)]">{a.name}</span>

                  {!user ? (
                    <button
                      type="button"
                      onClick={() => setLoginOpen(true)}
                      className="mt-auto flex items-center gap-1 rounded-xl border-2 border-[var(--border)] px-3 py-1.5 text-sm font-bold text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
                    >
                      <PriceTag value={price} />
                    </button>
                  ) : isOwned ? (
                    <span className="mt-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[var(--fg-muted)]">
                      <Check className="h-3.5 w-3.5" /> {isEquipped ? "Equipado" : "No inventário"}
                    </span>
                  ) : confirming ? (
                    <div className="mt-auto flex w-full flex-col gap-1.5">
                      <p className="text-xs text-[var(--fg-muted)]">
                        Comprar por <b className="text-[var(--fg)]">{price}</b>?
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleBuy(a)}
                          disabled={busyId === a.id}
                          className="flex-1 rounded-xl bg-[var(--primary)] py-1.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                        >
                          {busyId === a.id ? "..." : "Comprar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          aria-label="Cancelar compra"
                          className="flex w-9 items-center justify-center rounded-xl border-2 border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : missing > 0 ? (
                    <div className="mt-auto flex flex-col items-center gap-1">
                      <span className="flex items-center gap-1 rounded-xl border-2 border-[var(--border)] px-3 py-1.5 text-sm font-bold text-[var(--fg-muted)]">
                        <PriceTag value={price} />
                      </span>
                      <span className="text-xs text-[var(--fg-muted)]">faltam {missing}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmId(a.id);
                        setLastPurchase(null);
                      }}
                      className="mt-auto flex items-center gap-1 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-95"
                    >
                      <PriceTag value={price} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {byAchievement.length > 0 && !loading && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold tracking-tight text-[var(--fg)]">Por conquista</h2>
            <p className="text-sm text-[var(--fg-muted)]">Não estão à venda: são liberados jogando.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {byAchievement.map((a) => {
              const isOwned = ownedIds.has(a.id);
              return (
                <div
                  key={a.id}
                  className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-center"
                >
                  <span className={isOwned ? "" : "opacity-50 grayscale"}>
                    <Avatar emoji={a.emoji} bgColor={a.bg_color} imageUrl={a.image_url} size="lg" />
                  </span>
                  <span className="text-sm font-bold text-[var(--fg)]">{a.name}</span>
                  {isOwned ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                      <Trophy className="h-3.5 w-3.5" /> Desbloqueado
                    </span>
                  ) : (
                    <span className="flex items-start gap-1 text-xs text-[var(--fg-muted)]">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                      {a.achievement?.description ?? "Libere com uma conquista"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-10 text-center">
        <Gamepad2 className="h-8 w-8 text-[var(--fg-muted)]" />
        <p className="font-display text-lg font-extrabold text-[var(--fg)]">Itens de jogos em breve</p>
        <p className="max-w-sm text-sm text-[var(--fg-muted)]">
          Temas, efeitos e outros itens pros jogos vão aparecer aqui. O que você comprar fica no{" "}
          <Link href="/profile" className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline">
            inventário do seu perfil
          </Link>
          .
        </p>
      </section>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
