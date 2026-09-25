"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Coins, Gamepad2, Pencil, ShoppingBag, Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { equipAvatar, getInventory, getShopCatalog, updateUsername } from "@/lib/inventory";
import { Avatar } from "@/components/Avatar";
import { LoginPrompt } from "@/components/LoginPrompt";
import type { Avatar as AvatarType } from "@/lib/types";

type InventoryTab = "avatars" | "items";

const USERNAME_RULE = /^[A-Za-z0-9_.-]{3,20}$/;

function UsernameEditor({ current }: { current: string }) {
  const { refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function start() {
    setValue(current);
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (name === current) {
      setEditing(false);
      return;
    }
    if (!USERNAME_RULE.test(name)) {
      setError("Use de 3 a 20 caracteres: letras, números, ponto, hífen ou _.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateUsername(name);
      await refreshProfile();
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate font-display text-2xl font-extrabold tracking-tight text-[var(--fg)] sm:text-3xl">
          {current}
        </h2>
        <button
          type="button"
          onClick={start}
          aria-label="Editar nome de usuário"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border)] text-[var(--fg-muted)] transition hover:bg-[var(--bg)] hover:text-[var(--fg)]"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex w-full max-w-sm flex-col gap-1.5">
      <label htmlFor="username-input" className="text-xs font-semibold text-[var(--fg-muted)]">
        Nome de usuário
      </label>
      <div className="flex gap-2">
        <input
          id="username-input"
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={20}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base font-bold text-[var(--fg)] outline-none transition focus:border-[var(--primary)]"
        />
        <button
          type="submit"
          disabled={saving}
          aria-label="Salvar nome"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <Check className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancelar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border)] text-[var(--fg-muted)] transition hover:bg-[var(--bg)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className={`text-xs ${error ? "font-semibold text-[var(--danger)]" : "text-[var(--fg-muted)]"}`}>
        {error ?? "3 a 20 caracteres: letras, números, ponto, hífen ou _. Também serve pra entrar."}
      </p>
    </form>
  );
}

export function ProfilePageContent() {
  const { user, username, coins, equippedAvatar, refreshProfile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<InventoryTab>("avatars");
  const [owned, setOwned] = useState<AvatarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [catalog, inventory] = await Promise.all([getShopCatalog(), getInventory(user.id)]);
      const ids = new Set(inventory.map((i) => i.avatar_id));
      setOwned(catalog.filter((a) => ids.has(a.id)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (authLoading) return null;

  if (!user) {
    return (
      <LoginPrompt
        title="Seu perfil fica aqui"
        text="Entre na sua conta pra escolher avatar, mudar o nome de usuário e ver seu inventário."
      />
    );
  }

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

  const name = username ?? user.email ?? "";
  const memberSince = new Date(user.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-8">
      <section className="animate-fade-up flex flex-col gap-5 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="shrink-0 self-center rounded-full p-1 ring-4 ring-[var(--primary-tint)] sm:self-auto">
          <Avatar
            emoji={equippedAvatar?.emoji}
            bgColor={equippedAvatar?.bg_color}
            imageUrl={equippedAvatar?.image_url}
            fallbackLetter={name.charAt(0).toUpperCase() || "?"}
            size="xl"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <UsernameEditor key={name} current={name} />
          <p className="text-sm text-[var(--fg-muted)]">
            {equippedAvatar ? `Avatar: ${equippedAvatar.name}` : "Sem avatar equipado"} · no Arcadeon desde {memberSince}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--primary-tint)] px-3 py-1.5 text-sm font-bold tabular-nums text-[var(--primary)]">
              <Coins className="h-4 w-4" /> {coins} moedas
            </span>
            <Link
              href="/shop"
              className="flex items-center gap-1.5 rounded-full border-2 border-[var(--border)] px-3 py-1 text-sm font-bold text-[var(--fg-muted)] transition hover:bg-[var(--bg)] hover:text-[var(--fg)]"
            >
              <ShoppingBag className="h-4 w-4" /> Loja
            </Link>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold tracking-tight text-[var(--fg)]">Inventário</h2>
            <p className="text-sm text-[var(--fg-muted)]">Toque num avatar pra equipar.</p>
          </div>
          <div role="tablist" className="flex rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-1">
            {(
              [
                ["avatars", `Avatares${loading ? "" : ` · ${owned.length}`}`],
                ["items", "Itens de jogos"],
              ] as [InventoryTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                  tab === id ? "bg-[var(--primary)] text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-2xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm font-bold text-[var(--danger)]">
            {error}
          </p>
        )}

        {tab === "items" ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
            <Gamepad2 className="h-8 w-8 text-[var(--fg-muted)]" />
            <p className="font-display text-lg font-extrabold text-[var(--fg)]">Nenhum item ainda</p>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              Itens ganhos ou comprados pros jogos, como temas e efeitos, vão aparecer aqui.
            </p>
          </div>
        ) : loading ? (
          <p className="py-10 text-center text-sm text-[var(--fg-muted)]">Carregando...</p>
        ) : owned.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
            <Sparkles className="h-8 w-8 text-[var(--primary)]" />
            <p className="font-display text-lg font-extrabold text-[var(--fg)]">Você ainda não tem avatares</p>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">Ganhe moedas jogando e escolha um na loja.</p>
            <Link
              href="/shop"
              className="mt-1 inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110"
            >
              <ShoppingBag className="h-4 w-4" /> Ir pra loja
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
            {owned.map((a, i) => {
              const isEquipped = equippedAvatar?.id === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleEquip(a.id)}
                  disabled={busyId === a.id || isEquipped}
                  aria-pressed={isEquipped}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`animate-fade-up group flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-[0.97] ${
                    isEquipped
                      ? "border-[var(--primary)] bg-[var(--primary-tint)]"
                      : "border-[var(--border)] bg-[var(--card)] hover:-translate-y-1 hover:border-[var(--border-hover)]"
                  }`}
                >
                  <span className="transition-transform duration-200 group-hover:scale-110">
                    <Avatar emoji={a.emoji} bgColor={a.bg_color} imageUrl={a.image_url} size="lg" />
                  </span>
                  <span className="text-sm font-bold text-[var(--fg)]">{a.name}</span>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isEquipped ? "bg-[var(--primary)] text-white" : "text-[var(--fg-muted)]"
                    }`}
                  >
                    {isEquipped && <Check className="h-3 w-3" />}
                    {isEquipped ? "Equipado" : busyId === a.id ? "Equipando..." : "Equipar"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
