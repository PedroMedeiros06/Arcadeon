"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Coins, Flame, Play, Skull, Timer, Trophy, Users, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBlockTransition } from "@/lib/transition/TransitionProvider";
import { fetchDailyStatus, type DailyModeStatus, type DailyStatus } from "@/lib/termo/daily";
import { modeLabel, type BoardCount } from "@/lib/termo/logic";
import { getGame } from "@/lib/games";
import { GAME_ICONS } from "@/components/gameIcons";
import { FeatureCarousel } from "./FeatureCarousel";

/* ---------- moldura comum dos slides ---------- */

function SlideShell({
  accent,
  eyebrow,
  title,
  text,
  children,
  visual,
  mobileVisual,
}: {
  accent: string;
  eyebrow: string;
  title: string;
  text: string;
  /** chips e botoes abaixo do texto */
  children: React.ReactNode;
  visual: React.ReactNode;
  /** arte compacta pro celular (a lateral some abaixo de sm) */
  mobileVisual?: React.ReactNode;
}) {
  return (
    <div
      className="relative flex h-full min-h-[17rem] overflow-hidden rounded-3xl border-2 border-[var(--border)] p-5 sm:p-6"
      style={{
        borderTopColor: accent,
        borderTopWidth: 6,
        background: `linear-gradient(120deg, var(--card) 45%, color-mix(in srgb, ${accent} 16%, var(--card)))`,
      }}
    >
      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
          {eyebrow}
        </p>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--fg)] sm:text-3xl">{title}</h2>
        <p className="max-w-md text-sm text-[var(--fg-muted)]">{text}</p>
        {mobileVisual && (
          <div className="pointer-events-none pt-2 sm:hidden lg:block xl:hidden" aria-hidden>
            {mobileVisual}
          </div>
        )}
        <div className="mt-auto flex flex-col gap-3 pt-3">{children}</div>
      </div>
      <div className="pointer-events-none hidden shrink-0 items-center justify-center pl-4 sm:flex sm:w-52 lg:hidden xl:flex xl:w-60" aria-hidden>
        {visual}
      </div>
    </div>
  );
}

function PlayButton({ accent, label, href }: { accent: string; label: string; href: string }) {
  const { navigate } = useBlockTransition();
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-extrabold text-white transition hover:brightness-110 active:scale-[0.98] sm:w-auto sm:self-start"
      style={{ backgroundColor: accent }}
    >
      <Play className="h-4 w-4 fill-current" /> {label}
    </button>
  );
}

/* ---------- Letrado diario ---------- */

const SAMPLE: { letter: string; state: "correct" | "present" | "absent" }[] = [
  { letter: "J", state: "absent" },
  { letter: "O", state: "correct" },
  { letter: "G", state: "absent" },
  { letter: "A", state: "present" },
  { letter: "R", state: "correct" },
];

const TILE = {
  correct: "bg-[#8bbf6f] text-white",
  present: "bg-[#e0c26e] text-white",
  absent: "bg-[var(--key-absent)] text-[var(--key-absent-fg)]",
} as const;

const BOARD_COUNTS: BoardCount[] = [1, 2, 4];

const MODE_CHIP: Record<DailyModeStatus, { label: string; className: string }> = {
  not_started: { label: "a jogar", className: "border-[var(--border)] text-[var(--fg-muted)]" },
  playing: { label: "em andamento", className: "border-[var(--game-termo)] text-[var(--game-termo)]" },
  won: { label: "venceu", className: "border-transparent bg-[var(--game-termo)] text-white" },
  lost: { label: "não foi hoje", className: "border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]" },
};

function SampleTiles({ size }: { size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-10 w-10 text-lg lg:h-11 lg:w-11" : "h-8 w-8 text-sm";
  return (
    <div className="flex gap-1.5">
      {SAMPLE.map((t, i) => (
        <span
          key={i}
          className={`flex items-center justify-center rounded-lg font-display font-extrabold ${box} ${TILE[t.state]}`}
        >
          {t.letter}
        </span>
      ))}
    </div>
  );
}

function LetradoDailySlide() {
  const { user, loading } = useAuth();
  // null enquanto carrega ou se a RPC falhar: o slide fica no modo estatico
  const [status, setStatus] = useState<DailyStatus | null>(null);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    fetchDailyStatus()
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [loading, user?.id]);

  const modes = status ? BOARD_COUNTS.map((c) => ({ count: c, state: status.modes[c] ?? "not_started" })) : [];
  const allDone = modes.length > 0 && modes.every((m) => m.state === "won" || m.state === "lost");
  const anyStarted = modes.some((m) => m.state !== "not_started");

  return (
    <SlideShell
      accent="var(--game-termo)"
      eyebrow="Letrado diário"
      title={allDone ? "Você fechou o dia!" : anyStarted ? "Continue de onde parou" : "Palavra nova todo dia"}
      text={
        allDone
          ? "Volte amanhã pra uma palavra nova."
          : user || loading
            ? "Acerte e ganhe 10 moedas por modo (15 no difícil): Letrado, Duplo e Quádruplo."
            : "Entre com sua conta pra ganhar moedas e aparecer nos placares."
      }
      visual={<SampleTiles size="lg" />}
      mobileVisual={<SampleTiles size="sm" />}
    >
      {modes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {modes.map(({ count, state }) => (
            <span
              key={count}
              className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold ${MODE_CHIP[state].className}`}
            >
              {state === "won" && <Check className="h-3 w-3" />}
              {state === "lost" && <X className="h-3 w-3" />}
              {modeLabel(count)} · {MODE_CHIP[state].label}
            </span>
          ))}
          {status?.currentStreak ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-tint)] px-2.5 py-0.5 text-xs font-bold text-[var(--primary)]">
              <Flame className="h-3 w-3" /> {status.currentStreak} {status.currentStreak === 1 ? "dia" : "dias"}
            </span>
          ) : null}
        </div>
      )}
      <PlayButton
        accent="var(--game-termo)"
        href="/games/termo"
        label={allDone ? "Ver resultado" : anyStarted ? "Continuar" : "Jogar agora"}
      />
    </SlideShell>
  );
}

/* ---------- Letrado: modos extras ---------- */

function LetradoModesSlide() {
  const { navigate } = useBlockTransition();
  // TODO: abrir direto no modo quando /games/termo aceitar ?modo= (pedido em Pedidos-ao-Servidor)
  const modes = [
    { label: "Contra o Tempo", text: "Quantas palavras você acerta antes do relógio zerar?", Icon: Timer, href: "/games/termo" },
    { label: "Vilão", text: "A palavra muda pra fugir de você. Encurrale ela.", Icon: Skull, href: "/games/termo" },
  ];
  return (
    <SlideShell
      accent="var(--game-termo)"
      eyebrow="Letrado · outros modos"
      title="Já jogou o diário?"
      text="O Letrado tem mais desafios pra quando a palavra do dia acabar."
      visual={
        <div className="grid grid-cols-2 gap-3">
          <Timer className="h-16 w-16 rotate-[-8deg] text-[var(--game-termo)] opacity-80" />
          <Skull className="mt-8 h-16 w-16 rotate-[8deg] text-[var(--game-termo)] opacity-60" />
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {modes.map(({ label, text, Icon, href }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(href)}
            className="flex items-start gap-3 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-3 text-left transition hover:border-[var(--game-termo)] active:scale-[0.98]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--game-termo)] text-white">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-[var(--fg)]">{label}</span>
              <span className="hidden text-xs text-[var(--fg-muted)] sm:block lg:hidden xl:block">{text}</span>
            </span>
          </button>
        ))}
      </div>
    </SlideShell>
  );
}

/* ---------- jogos online ---------- */

function OnlineGameSlide({
  slug,
  eyebrow,
  title,
  text,
  visual,
}: {
  slug: string;
  eyebrow: string;
  title: string;
  text: string;
  visual: React.ReactNode;
}) {
  const game = getGame(slug);
  const Icon = GAME_ICONS[slug];
  return (
    <SlideShell accent={game.accent} eyebrow={eyebrow} title={title} text={text} visual={visual}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ color: game.accent, backgroundColor: `color-mix(in srgb, ${game.accent} 14%, transparent)` }}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />} {game.title}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--fg-muted)]">
          <Users className="h-3.5 w-3.5" /> {game.players} jogadores
        </span>
      </div>
      <PlayButton accent={game.accent} href={`/games/${slug}`} label="Criar sala" />
    </SlideShell>
  );
}

const BUGGLE_LETTERS = "ARCADEONPALAVRAS";

function BuggleVisual() {
  const path = new Set([0, 1, 5, 6]);
  return (
    <div className="grid grid-cols-4 gap-1.5 rotate-[-4deg]">
      {BUGGLE_LETTERS.split("").map((l, i) => (
        <span
          key={i}
          className={`flex h-10 w-10 items-center justify-center rounded-lg font-display text-lg font-extrabold ${
            path.has(i) ? "bg-[var(--game-buggle)] text-white" : "bg-[var(--bg)] text-[var(--fg-muted)]"
          }`}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

function DrawVisual() {
  return (
    <svg viewBox="0 0 200 160" className="h-40 w-52" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="188" height="148" rx="18" fill="var(--card)" stroke="var(--border)" strokeWidth="3" />
      <path d="M40 118 C 60 60, 90 60, 100 96 S 140 130, 160 70" stroke="var(--game-drawit)" strokeWidth="7" />
      <circle cx="150" cy="44" r="16" stroke="var(--game-drawit)" strokeWidth="6" opacity="0.6" />
      <path d="M36 44 l 14 14 M50 44 l -14 14" stroke="var(--fg-muted)" strokeWidth="5" opacity="0.5" />
    </svg>
  );
}

function RaceVisual() {
  const lanes = [
    { left: "72%", color: "var(--game-corrida)" },
    { left: "48%", color: "var(--primary)" },
    { left: "60%", color: "var(--game-buggle)" },
  ];
  return (
    <div className="flex w-full flex-col gap-2.5">
      {lanes.map((lane, i) => (
        <div key={i} className="relative h-9 rounded-xl bg-[var(--bg)]">
          <span className="absolute inset-y-0 right-2 my-auto h-5 w-1.5 rounded bg-[repeating-linear-gradient(var(--fg-muted)_0_4px,transparent_4px_8px)] opacity-60" />
          <span
            className="absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-4 border-[var(--card)]"
            style={{ left: lane.left, backgroundColor: lane.color }}
          />
        </div>
      ))}
    </div>
  );
}

/* ---------- composicao da home ---------- */

export function homeSlides() {
  return [
    { id: "letrado-diario", content: <LetradoDailySlide /> },
    { id: "letrado-modos", content: <LetradoModesSlide /> },
    {
      id: "corrida",
      content: (
        <OnlineGameSlide
          slug="corrida"
          eyebrow="Jogue com amigos"
          title="Quem sabe mais chega primeiro"
          text="Responda rápido, acerte em sequência e ultrapasse todo mundo na pista."
          visual={<RaceVisual />}
        />
      ),
    },
    {
      id: "buggle",
      content: (
        <OnlineGameSlide
          slug="buggle"
          eyebrow="Jogue com amigos"
          title="Caça-palavras em tempo real"
          text="Uma tela vira a TV da sala; cada um acha palavras no celular antes do tempo acabar."
          visual={<BuggleVisual />}
        />
      ),
    },
    {
      id: "drawit",
      content: (
        <OnlineGameSlide
          slug="drawit"
          eyebrow="Jogue com amigos"
          title="Desenhe mal, ria bastante"
          text="Um desenha, o resto chuta. Quanto mais rápido acertar, mais pontos."
          visual={<DrawVisual />}
        />
      ),
    },
  ];
}

export function HomeFeature() {
  const { user, coins } = useAuth();
  const slides = homeSlides();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <FeatureCarousel label="Destaques" slides={slides} />

      <div className="grid grid-cols-2 gap-4 self-start lg:grid-cols-1">
        <div className="flex flex-col justify-center gap-1 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-4">
          <span className="text-xs font-medium text-[var(--fg-muted)]">Suas moedas</span>
          <span className="flex items-center gap-2 font-display text-2xl font-extrabold tabular-nums text-[var(--fg)]">
            <Coins className="h-5 w-5 text-[var(--primary)]" /> {user ? coins : "—"}
          </span>
        </div>
        <Link
          href="/leaderboard"
          className="flex flex-col justify-center gap-1 rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--border-hover)] active:scale-[0.98]"
        >
          <span className="text-xs font-medium text-[var(--fg-muted)]">Placares</span>
          <span className="flex items-center gap-2 font-display text-lg font-extrabold text-[var(--fg)]">
            <Trophy className="h-5 w-5 text-[var(--primary)]" /> Ver ranking
          </span>
        </Link>
      </div>
    </div>
  );
}
