"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const COVER_MS = 280;
const REVEAL_MS = 280;
const HOLD_MS = 40;
const BLOCK_COUNT = 64;

interface Block {
  left: number;
  top: number;
  size: number;
  delay: number;
  rotate: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildBlocks(): Block[] {
  const rand = seededRandom(42);
  const cols = 8;
  const rows = 6;
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const blocks: Block[] = [];

  for (let i = 0; i < BLOCK_COUNT; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols) % rows;
    const jitterX = (rand() - 0.5) * cellW * 0.6;
    const jitterY = (rand() - 0.5) * cellH * 0.6;
    const size = cellW * (1.15 + rand() * 0.85);
    const order = col + row;
    blocks.push({
      left: col * cellW + jitterX,
      top: row * cellH + jitterY,
      size,
      delay: order * 9 + rand() * 22,
      rotate: (rand() - 0.5) * 6,
    });
  }
  return blocks;
}

interface TransitionContextValue {
  navigate: (href: string) => void;
}

const TransitionContext = createContext<TransitionContextValue | undefined>(undefined);

export function useBlockTransition() {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error("useBlockTransition must be used within TransitionProvider");
  return ctx;
}

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "covering" | "covered" | "revealing">("idle");
  const pendingHref = useRef<string | null>(null);
  const lastPathname = useRef(pathname);
  const blocks = useMemo(buildBlocks, []);
  const maxDelay = useMemo(() => Math.max(...blocks.map((b) => b.delay)), [blocks]);

  const navigate = useCallback(
    (href: string) => {
      if (phase !== "idle") return;
      pendingHref.current = href;
      setPhase("covering");
    },
    [phase],
  );

  useEffect(() => {
    if (phase !== "covering") return;
    const t = setTimeout(() => {
      setPhase("covered");
      if (pendingHref.current) {
        router.push(pendingHref.current);
        pendingHref.current = null;
      }
    }, COVER_MS + maxDelay);
    return () => clearTimeout(t);
  }, [phase, router, maxDelay]);

  useEffect(() => {
    if (pathname === lastPathname.current) return;
    lastPathname.current = pathname;
    if (phase === "covered") {
      const t = setTimeout(() => setPhase("revealing"), HOLD_MS);
      return () => clearTimeout(t);
    }
  }, [pathname, phase]);

  useEffect(() => {
    if (phase !== "revealing") return;
    const t = setTimeout(() => setPhase("idle"), REVEAL_MS + maxDelay);
    return () => clearTimeout(t);
  }, [phase, maxDelay]);

  const active = phase !== "idle";
  const isRevealing = phase === "revealing";

  return (
    <TransitionContext.Provider value={{ navigate }}>
      {children}
      {active && (
        <div className="pointer-events-none fixed inset-0 z-[999] overflow-hidden">
          <div
            className="absolute inset-0 bg-black"
            style={{
              animation: isRevealing
                ? `fadeOutSolid ${REVEAL_MS}ms ease-in forwards`
                : `fadeInSolid ${COVER_MS}ms ease-out forwards`,
              animationDelay: isRevealing ? `${maxDelay * 0.4}ms` : `${maxDelay * 0.5}ms`,
              opacity: phase === "covering" ? 0 : 1,
            }}
          />
          {blocks.map((b, i) => (
            <span
              key={i}
              className="absolute bg-black shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
              style={{
                left: `${b.left}%`,
                top: `${b.top}%`,
                width: `${b.size}%`,
                height: `${b.size}%`,
                transform: `rotate(${b.rotate}deg)`,
                animation: isRevealing
                  ? `tileOut ${REVEAL_MS}ms ease-in forwards`
                  : `tileIn ${COVER_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
                animationDelay: `${isRevealing ? maxDelay - b.delay : b.delay}ms`,
                opacity: phase === "covering" ? 0 : 1,
              }}
            />
          ))}
        </div>
      )}
    </TransitionContext.Provider>
  );
}
