"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brush, Circle, EyeOff, Eraser, PaintBucket, Slash, Square, Trash2, Undo2 } from "lucide-react";
import { FADE_LIFE_MS, FADE_OUT_MS } from "@/lib/draw/modes";
import type { CanvasHandlers, DrawEvent, FillEvent, Point, ShapeEvent, ShapeKind } from "@/lib/draw/types";

/** Restricoes do turno (modificadores) ou do modo (impostor). Tudo opcional = canvas completo. */
export interface CanvasRules {
  /** so preto + borracha */
  mono?: boolean;
  /** sem borracha, desfazer e limpar */
  noUndo?: boolean;
  noFill?: boolean;
  noShapes?: boolean;
  /** tracos somem depois de alguns segundos */
  fading?: boolean;
  /** quem desenha nao ve o proprio desenho */
  blind?: boolean;
  /** impostor: cor fixa do jogador, sem paleta */
  forcedColor?: string | null;
  /** impostor: um traco e acabou a vez */
  singleStroke?: boolean;
}

interface CanvasProps {
  /** desenhista E fase "drawing": so ai os controles e o ponteiro ficam ativos */
  canDraw: boolean;
  /** fragmento de traco (mesmo id ate soltar o dedo) */
  onStroke: (id: string, points: Point[], color: string, width: number) => void;
  onFill: (event: FillEvent) => void;
  onShape: (event: ShapeEvent) => void;
  onClear: (id: string) => void;
  onUndo: () => void;
  registerHandlers: (handlers: CanvasHandlers | null) => void;
  rules?: CanvasRules;
  /** impostor: soltou o dedo depois do traco da vez */
  onStrokeDone?: () => void;
  /** overlays (acerto, resumo do turno) desenhados por cima do canvas */
  children?: ReactNode;
}

// Coordenadas logicas fixas: todo client desenha num quadro 800x600. O desenho de verdade vive
// num canvas fora da tela em resolucao fixa (RES x); a tela so mostra uma copia escalada. Assim o
// balde de tinta pinta exatamente a mesma area em todo aparelho, qualquer que seja o tamanho.
const LOGICAL_W = 800;
const LOGICAL_H = 600;
const RES = 2;
const PX_W = LOGICAL_W * RES;
const PX_H = LOGICAL_H * RES;

const COLORS = [
  "#000000", "#6b7280", "#ffffff", "#ef4444", "#f43f5e", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#1cb0f6", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#fda4af",
  "#78350f", "#1c1a2e",
];
const SIZES = [3, 7, 14, 26];
const ERASER = "#ffffff";
const FLUSH_MS = 40;

type Tool = "brush" | "eraser" | "fill" | ShapeKind;

const TOOLS: { tool: Tool; label: string; Icon: typeof Brush; key: string }[] = [
  { tool: "brush", label: "Pincel", Icon: Brush, key: "b" },
  { tool: "eraser", label: "Borracha", Icon: Eraser, key: "e" },
  { tool: "fill", label: "Balde de tinta", Icon: PaintBucket, key: "g" },
  { tool: "line", label: "Linha", Icon: Slash, key: "l" },
  { tool: "rect", label: "Retângulo", Icon: Square, key: "r" },
  { tool: "ellipse", label: "Círculo", Icon: Circle, key: "c" },
];

const isShape = (tool: Tool): tool is ShapeKind => tool === "line" || tool === "rect" || tool === "ellipse";

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- rasterizacao (sempre no canvas logico, coordenadas 800x600) ----------

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number) {
  if (points.length === 0) return;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

function drawShape(ctx: CanvasRenderingContext2D, s: Omit<ShapeEvent, "type" | "id">) {
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (s.shape === "line") {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  } else if (s.shape === "rect") {
    ctx.rect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1));
  } else {
    const rx = Math.abs(s.x2 - s.x1) / 2;
    const ry = Math.abs(s.y2 - s.y1) / 2;
    ctx.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
  }
  ctx.stroke();
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Balde de tinta: pinta a regiao conectada de cor parecida com a do ponto clicado (tolerancia
 * absorve o antialias dos tracos) e expande 1px pra nao sobrar franja clara na borda.
 */
function floodFill(ctx: CanvasRenderingContext2D, lx: number, ly: number, hex: string) {
  const sx = Math.floor(lx * RES);
  const sy = Math.floor(ly * RES);
  if (sx < 0 || sy < 0 || sx >= PX_W || sy >= PX_H) return;

  const image = ctx.getImageData(0, 0, PX_W, PX_H);
  const data = image.data;
  const start = (sy * PX_W + sx) * 4;
  const r0 = data[start];
  const g0 = data[start + 1];
  const b0 = data[start + 2];
  const [fr, fg, fb] = hexToRgb(hex);
  if (Math.abs(r0 - fr) + Math.abs(g0 - fg) + Math.abs(b0 - fb) < 12) return;

  const TOL = 48;
  const matches = (p: number) => {
    const i = p * 4;
    return (
      Math.abs(data[i] - r0) <= TOL && Math.abs(data[i + 1] - g0) <= TOL && Math.abs(data[i + 2] - b0) <= TOL
    );
  };

  const mask = new Uint8Array(PX_W * PX_H);
  const stack = [sy * PX_W + sx];
  while (stack.length) {
    const p = stack.pop()!;
    if (mask[p]) continue;
    const y = Math.floor(p / PX_W);
    let x = p - y * PX_W;
    // anda ate a ponta esquerda da linha e preenche pra direita (scanline)
    while (x > 0 && !mask[y * PX_W + x - 1] && matches(y * PX_W + x - 1)) x--;
    let upOpen = false;
    let downOpen = false;
    for (; x < PX_W; x++) {
      const q = y * PX_W + x;
      if (mask[q] || !matches(q)) break;
      mask[q] = 1;
      if (y > 0) {
        const up = q - PX_W;
        const ok = !mask[up] && matches(up);
        if (ok && !upOpen) stack.push(up);
        upOpen = ok;
      }
      if (y < PX_H - 1) {
        const down = q + PX_W;
        const ok = !mask[down] && matches(down);
        if (ok && !downOpen) stack.push(down);
        downOpen = ok;
      }
    }
  }

  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const x = p % PX_W;
    paint(p);
    if (x > 0 && !mask[p - 1]) paint(p - 1);
    if (x < PX_W - 1 && !mask[p + 1]) paint(p + 1);
    if (p >= PX_W && !mask[p - PX_W]) paint(p - PX_W);
    if (p + PX_W < mask.length && !mask[p + PX_W]) paint(p + PX_W);
  }
  function paint(p: number) {
    const i = p * 4;
    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

/** Opacidade de um evento no modificador "some aos poucos" (1 = normal, 0 = sumiu). */
function fadeAlpha(event: DrawEvent, now: number): number {
  const age = now - (event.at ?? now);
  if (age <= FADE_LIFE_MS - FADE_OUT_MS) return 1;
  return Math.max(0, (FADE_LIFE_MS - age) / FADE_OUT_MS);
}

function renderEvent(ctx: CanvasRenderingContext2D, event: DrawEvent, alpha = 1) {
  if (alpha <= 0) return;
  if (event.type === "stroke" || event.type === "shape") {
    ctx.globalAlpha = alpha;
    if (event.type === "stroke") drawStroke(ctx, event.points, event.color, event.width);
    else drawShape(ctx, event);
    ctx.globalAlpha = 1;
  } else if (event.type === "fill") {
    // putImageData ignora o transform: floodFill trabalha em pixels do canvas logico
    floodFill(ctx, event.x, event.y, event.color);
  } else {
    wipe(ctx);
  }
}

function wipe(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

export function Canvas({
  canDraw,
  onStroke,
  onFill,
  onShape,
  onClear,
  onUndo,
  registerHandlers,
  rules = {},
  onStrokeDone,
  children,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState<Tool>("brush");
  const [box, setBox] = useState({ w: 0, h: 0 });

  // canvas logico (fonte da verdade) + lista de eventos do turno, na ordem
  const paperRef = useRef<HTMLCanvasElement | null>(null);
  const eventsRef = useRef<DrawEvent[]>([]);
  const presentFrameRef = useRef<number | null>(null);

  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<{ id: string; color: string; width: number } | null>(null);
  const bufferRef = useRef<Point[]>([]);
  const lastPointRef = useRef<Point | null>(null);
  const lastFlushRef = useRef(0);
  const shapeStartRef = useRef<Point | null>(null);
  const shapePreviewRef = useRef<Omit<ShapeEvent, "type" | "id"> | null>(null);
  const fadingRef = useRef(!!rules.fading);
  // impostor: ja fez o traco desta vez
  const strokeUsedRef = useRef(false);

  const palette = rules.mono ? ["#000000"] : COLORS;
  const tools = TOOLS.filter(
    ({ tool: t }) =>
      !(t === "eraser" && rules.noUndo) &&
      !(t === "fill" && (rules.noFill || rules.fading)) &&
      !(isShape(t) && rules.noShapes)
  );
  // ferramenta ou cor que a regra do turno tirou volta pro pincel preto
  const activeTool: Tool = tools.some((t) => t.tool === tool) ? tool : "brush";
  const activeColor = rules.forcedColor ?? (palette.includes(color) ? color : palette[0]);
  const strokeColor = activeTool === "eraser" ? ERASER : activeColor;

  useEffect(() => {
    fadingRef.current = !!rules.fading;
  }, [rules.fading]);

  // nova vez no impostor: libera 1 traco
  useEffect(() => {
    if (canDraw) strokeUsedRef.current = false;
  }, [canDraw]);

  function paperCtx(): CanvasRenderingContext2D | null {
    if (!paperRef.current) {
      const paper = document.createElement("canvas");
      paper.width = PX_W;
      paper.height = PX_H;
      paperRef.current = paper;
      const ctx = paper.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      wipe(ctx);
      return ctx;
    }
    return paperRef.current.getContext("2d", { willReadFrequently: true });
  }

  /** Copia o papel pra tela (no maximo 1x por frame) + previa da forma sendo arrastada. */
  function schedulePresent() {
    if (presentFrameRef.current !== null) return;
    presentFrameRef.current = requestAnimationFrame(() => {
      presentFrameRef.current = null;
      const canvas = canvasRef.current;
      const paper = paperRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !paper || !ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(paper, 0, 0, canvas.width, canvas.height);
      const preview = shapePreviewRef.current;
      if (preview) {
        const scale = canvas.width / LOGICAL_W;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        drawShape(ctx, preview);
      }
    });
  }

  /** Redesenha tudo a partir da lista (undo, reconexao). */
  function replay() {
    const ctx = paperCtx();
    if (!ctx) return;
    wipe(ctx);
    const now = Date.now();
    for (const event of eventsRef.current) renderEvent(ctx, event, fadingRef.current ? fadeAlpha(event, now) : 1);
    schedulePresent();
  }

  function pushAndRender(event: DrawEvent) {
    if (event.at === undefined) event.at = Date.now();
    eventsRef.current.push(event);
    const ctx = paperCtx();
    if (ctx) renderEvent(ctx, event);
    schedulePresent();
  }

  function removeEvent(id: string) {
    const index = eventsRef.current.findIndex((e) => e.id === id);
    if (index === -1) return;
    eventsRef.current.splice(index, 1);
    replay();
  }

  useEffect(() => {
    paperCtx();
    registerHandlers({
      applyEvent: (event) => {
        if (event.type === "stroke") {
          const existing = eventsRef.current.find((e) => e.type === "stroke" && e.id === event.id);
          if (existing && existing.type === "stroke") {
            const last = existing.points[existing.points.length - 1];
            const ctx = paperCtx();
            if (ctx) drawStroke(ctx, last ? [last, ...event.points] : event.points, existing.color, existing.width);
            existing.points.push(...event.points);
            schedulePresent();
            return;
          }
          // relogio local: o "some aos poucos" conta a partir de quando chegou aqui
          pushAndRender({ ...event, points: [...event.points], at: Date.now() });
          return;
        }
        pushAndRender({ ...event, at: Date.now() });
      },
      applyUndo: removeEvent,
      load: (events, clockOffset) => {
        const now = Date.now();
        eventsRef.current = events.map((e) => ({
          ...e,
          ...(e.type === "stroke" ? { points: [...e.points] } : {}),
          at: e.at !== undefined ? e.at - clockOffset : now,
        }));
        replay();
      },
      snapshot: () => {
        let paper = paperRef.current;
        const lastClear = eventsRef.current.map((e) => e.type).lastIndexOf("clear");
        if (!paper || eventsRef.current.length - 1 === lastClear) return null;
        try {
          if (fadingRef.current) {
            // na galeria vai o desenho inteiro, sem o desbotado
            const full = document.createElement("canvas");
            full.width = PX_W;
            full.height = PX_H;
            const fctx = full.getContext("2d", { willReadFrequently: true });
            if (!fctx) return null;
            fctx.setTransform(RES, 0, 0, RES, 0, 0);
            wipe(fctx);
            for (const event of eventsRef.current) renderEvent(fctx, event);
            paper = full;
          }
          const out = document.createElement("canvas");
          out.width = 480;
          out.height = 360;
          const octx = out.getContext("2d");
          if (!octx) return null;
          octx.imageSmoothingQuality = "high";
          octx.drawImage(paper, 0, 0, out.width, out.height);
          return out.toDataURL("image/jpeg", 0.82);
        } catch {
          return null;
        }
      },
    });
    return () => {
      registerHandlers(null);
      if (presentFrameRef.current !== null) {
        cancelAnimationFrame(presentFrameRef.current);
        // sem zerar, o proximo schedulePresent acharia que ja tem frame agendado e a tela congelaria
        presentFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // encaixa um retangulo 4:3 no espaco disponivel (largura OU altura limita, o que vier primeiro)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const w = Math.floor(Math.min(width, (height * LOGICAL_W) / LOGICAL_H));
      setBox({ w, h: Math.floor((w * LOGICAL_H) / LOGICAL_W) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || box.w === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.w * dpr);
    canvas.height = Math.round(box.h * dpr);
    schedulePresent();
  }, [box.w, box.h]);

  // "some aos poucos": redesenha com a opacidade de cada traco pela idade
  useEffect(() => {
    if (!rules.fading) return;
    const id = setInterval(replay, 150);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules.fading]);

  // atalhos no desktop: B/E/G/L/R/C trocam a ferramenta, Ctrl+Z desfaz
  useEffect(() => {
    if (!canDraw) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !rules.noUndo && !rules.singleStroke) {
        e.preventDefault();
        handleUndoClick();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const match = tools.find((t) => t.key === e.key.toLowerCase());
      if (match) setTool(match.tool);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDraw, tools.length]);

  function getLogicalPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
    const y = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;
    // 1 casa decimal basta e deixa o payload do socket menor
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }

  function flushBuffer() {
    const stroke = currentStrokeRef.current;
    if (bufferRef.current.length === 0 || !stroke) return;
    onStroke(stroke.id, bufferRef.current, stroke.color, stroke.width);
    bufferRef.current = [];
    lastFlushRef.current = Date.now();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || drawingRef.current) return;
    if (rules.singleStroke && strokeUsedRef.current) return;
    const point = getLogicalPoint(e);

    if (activeTool === "fill") {
      const event: FillEvent = { type: "fill", id: newId(), x: point.x, y: point.y, color: activeColor };
      pushAndRender(event);
      onFill(event);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;

    if (isShape(activeTool)) {
      shapeStartRef.current = point;
      shapePreviewRef.current = {
        shape: activeTool,
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
        color: activeColor,
        width: size,
      };
      schedulePresent();
      return;
    }

    const stroke = { id: newId(), color: strokeColor, width: size };
    currentStrokeRef.current = stroke;
    lastPointRef.current = point;
    bufferRef.current = [point];
    lastFlushRef.current = Date.now();
    pushAndRender({ type: "stroke", id: stroke.id, points: [point], color: stroke.color, width: stroke.width });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || !drawingRef.current) return;
    const point = getLogicalPoint(e);

    if (shapePreviewRef.current) {
      shapePreviewRef.current = { ...shapePreviewRef.current, x2: point.x, y2: point.y };
      schedulePresent();
      return;
    }

    const stroke = currentStrokeRef.current;
    const prev = lastPointRef.current;
    if (!stroke) return;
    const ctx = paperCtx();
    if (ctx && prev) drawStroke(ctx, [prev, point], stroke.color, stroke.width);
    schedulePresent();
    lastPointRef.current = point;
    bufferRef.current.push(point);
    const local = eventsRef.current.find((ev) => ev.id === stroke.id);
    if (local?.type === "stroke") local.points.push(point);

    if (Date.now() - lastFlushRef.current >= FLUSH_MS) flushBuffer();
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    const preview = shapePreviewRef.current;
    if (preview) {
      shapePreviewRef.current = null;
      shapeStartRef.current = null;
      // clique sem arrastar nao vira forma
      if (Math.hypot(preview.x2 - preview.x1, preview.y2 - preview.y1) >= 3) {
        const event: ShapeEvent = { type: "shape", id: newId(), ...preview };
        pushAndRender(event);
        onShape(event);
      } else {
        schedulePresent();
      }
      return;
    }

    flushBuffer();
    currentStrokeRef.current = null;
    lastPointRef.current = null;
    if (rules.singleStroke) {
      strokeUsedRef.current = true;
      onStrokeDone?.();
    }
  }

  function handleUndoClick() {
    const last = eventsRef.current[eventsRef.current.length - 1];
    if (!last) return;
    eventsRef.current.pop();
    replay();
    onUndo();
  }

  function handleClearClick() {
    const event: DrawEvent = { type: "clear", id: newId() };
    pushAndRender(event);
    onClear(event.id);
  }

  const toolBtn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-90 sm:h-10 sm:w-10";
  const cursor = !canDraw ? "" : activeTool === "fill" ? "cursor-cell" : "cursor-crosshair";
  const showPalette = !rules.forcedColor;
  const showActions = !rules.noUndo && !rules.singleStroke;

  return (
    <div className="flex min-h-0 flex-1 select-none flex-col gap-1.5 sm:gap-2">
      <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="relative overflow-hidden rounded-xl border-2 border-[var(--border)] bg-white shadow-sm sm:rounded-2xl"
          style={{ width: box.w || undefined, height: box.h || undefined }}
        >
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 h-full w-full ${cursor}`}
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {/* as cegas: o desenho continua indo pros outros, so o desenhista nao ve */}
          {canDraw && rules.blind && (
            <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 bg-[#1d1b2e] p-4 text-center text-white/80">
              <EyeOff size={34} />
              <span className="text-sm font-extrabold uppercase tracking-wide">Às cegas</span>
              <span className="text-xs font-semibold text-white/60">Desenhe mesmo assim: os outros estão vendo</span>
            </div>
          )}
          {children}
        </div>
      </div>

      {canDraw && (
        <div className="animate-fade-up flex shrink-0 flex-col gap-1.5 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-1.5 sm:gap-2 sm:p-2">
          {/* paleta: uma linha com scroll horizontal no celular, quebra em linhas no desktop */}
          {rules.forcedColor && (
            <p className="flex items-center gap-2 px-1 text-xs font-bold text-[var(--fg-muted)]">
              <span
                className="h-5 w-5 shrink-0 rounded-full border-2 border-[var(--border)]"
                style={{ backgroundColor: rules.forcedColor }}
              />
              Sua cor nesta rodada · um traço por vez
            </p>
          )}
          {showPalette && (
          <div className="no-scrollbar -mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 py-0.5 sm:flex-wrap sm:overflow-visible">
            {palette.map((c) => {
              const selected = activeTool !== "eraser" && activeColor === c;
              return (
                <button
                  key={c}
                  aria-label={`Cor ${c}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setColor(c);
                    if (activeTool === "eraser") setTool("brush");
                  }}
                  className={`h-7 w-7 shrink-0 rounded-full border-2 transition ${
                    selected
                      ? "scale-110 border-[var(--primary)] ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--card)]"
                      : "border-[var(--border)] hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              );
            })}
          </div>
          )}

          {/* celular: ferramentas + desfazer/limpar numa linha, espessuras na de baixo; desktop: tudo junto */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
              {tools.map(({ tool: t, label, Icon, key }) => (
                <button
                  key={t}
                  aria-label={label}
                  title={`${label} (${key.toUpperCase()})`}
                  aria-pressed={activeTool === t}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setTool(t)}
                  className={`${toolBtn} ${
                    activeTool === t
                      ? "border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--primary)]"
                      : "border-[var(--border)] text-[var(--fg)]"
                  }`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>

            <div className="order-last flex basis-full items-center gap-1 sm:order-none sm:basis-auto">
              <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-[var(--border)] sm:block" aria-hidden />
              <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--fg-muted)] sm:hidden">
                Espessura
              </span>
              {SIZES.map((s) => (
                <button
                  key={s}
                  aria-label={`Espessura ${s}`}
                  aria-pressed={size === s}
                  disabled={activeTool === "fill"}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSize(s)}
                  className={`${toolBtn} disabled:opacity-35 ${
                    size === s ? "border-[var(--primary)] bg-[var(--primary-tint)]" : "border-[var(--border)]"
                  }`}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: Math.max(4, Math.min(22, s * 0.8)),
                      height: Math.max(4, Math.min(22, s * 0.8)),
                      backgroundColor:
                        activeTool === "eraser" ? "var(--fg-muted)" : activeColor === "#ffffff" ? "#d1d5db" : activeColor,
                    }}
                  />
                </button>
              ))}
            </div>

            {showActions && (
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button
                aria-label="Desfazer"
                title="Desfazer (Ctrl+Z)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleUndoClick}
                className={`${toolBtn} border-[var(--border)] text-[var(--fg)] hover:border-[var(--primary)]`}
              >
                <Undo2 size={16} />
              </button>
              <button
                aria-label="Limpar tudo"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearClick}
                className={`${toolBtn} border-[var(--border)] text-[var(--fg)] hover:border-[var(--danger)] hover:text-[var(--danger)]`}
              >
                <Trash2 size={16} />
              </button>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
