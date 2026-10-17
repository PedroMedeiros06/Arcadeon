"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Flame, Play, Skull, Timer, Users, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBlockTransition } from "@/lib/transition/TransitionProvider";
import { type DailyModeStatus, type DailyStatus } from "@/lib/termo/daily";
import { getDailyStatusShared } from "@/lib/home/dailyStatus";
import { modeLabel, type BoardCount } from "@/lib/termo/logic";
import { getGame } from "@/lib/games";
import { GAME_ICONS } from "@/components/gameIcons";
import { FeatureCarousel, type FeatureSlide } from "./FeatureCarousel";
import { HomeAside } from "./HomeAside";

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
        <p className="text-sm font-bold" style={{ color: accent }}>
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

const BOARD_COUNTS: BoardCount[] = [1, 2, 4];

const GAME_ART = {
  termo: "/games/letrado.png",
  buggle: "/games/buggle.png",
  drawit: "/games/rabiscado.png",
  corrida: "/games/corrida.png",
} as const;

function GameArtwork({ slug, compact = false }: { slug: keyof typeof GAME_ART; compact?: boolean }) {
  return (
    <div className={`relative ${compact ? "h-20 w-full" : "h-44 w-full"}`}>
      <Image
        src={GAME_ART[slug]}
        alt=""
        fill
        unoptimized
        sizes={compact ? "320px" : "240px"}
        className="object-contain drop-shadow-[0_12px_18px_rgb(0_0_0/0.18)]"
      />
    </div>
  );
}

const MODE_CHIP: Record<DailyModeStatus, { label: string; className: string }> = {
  not_started: { label: "a jogar", className: "border-[var(--border)] text-[var(--fg-muted)]" },
  playing: { label: "em andamento", className: "border-[var(--game-termo)] text-[var(--game-termo)]" },
  won: { label: "venceu", className: "border-transparent bg-[var(--game-termo)] text-white" },
  lost: { label: "não foi hoje", className: "border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]" },
};

function LetradoDailySlide() {
  const { user, loading } = useAuth();
  // null enquanto carrega ou se a RPC falhar: o slide fica no modo estatico
  const [status, setStatus] = useState<DailyStatus | null>(null);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    getDailyStatusShared(user?.id ?? "anon")
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
      visual={<GameArtwork slug="termo" />}
      mobileVisual={<GameArtwork slug="termo" compact />}
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
      eyebrow="Outros modos do Letrado"
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

/* ---------- composicao da home ---------- */

export function homeSlides(): FeatureSlide[] {
  return [
    { id: "letrado-diario", label: "Letrado do dia", slug: "termo", content: <LetradoDailySlide /> },
    { id: "letrado-modos", label: "Outros modos", slug: "termo", content: <LetradoModesSlide /> },
    {
      id: "corrida",
      label: "Corrida",
      slug: "corrida",
      content: (
        <OnlineGameSlide
          slug="corrida"
          eyebrow="Jogue com amigos"
          title="Quem sabe mais chega primeiro"
          text="Responda rápido, acerte em sequência e ultrapasse todo mundo na pista."
          visual={<GameArtwork slug="corrida" />}
        />
      ),
    },
    {
      id: "buggle",
      label: "Buggle",
      slug: "buggle",
      content: (
        <OnlineGameSlide
          slug="buggle"
          eyebrow="Jogue com amigos"
          title="Caça-palavras em tempo real"
          text="Uma tela vira a TV da sala; cada um acha palavras no celular antes do tempo acabar."
          visual={<GameArtwork slug="buggle" />}
        />
      ),
    },
    {
      id: "drawit",
      label: "Rabiscado",
      slug: "drawit",
      content: (
        <OnlineGameSlide
          slug="drawit"
          eyebrow="Jogue com amigos"
          title="Desenhe mal, ria bastante"
          text="Um desenha, o resto chuta. Quanto mais rápido acertar, mais pontos."
          visual={<GameArtwork slug="drawit" />}
        />
      ),
    },
  ];
}

export function HomeFeature() {
  const slides = homeSlides();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <FeatureCarousel label="Destaques" slides={slides} />
      <HomeAside />
    </div>
  );
}
