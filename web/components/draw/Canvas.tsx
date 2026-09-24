"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eraser, Trash2, Undo2 } from "lucide-react";

interface LocalStroke {
  strokeId: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface CanvasProps {
  /** desenhista E fase "drawing": so ai os controles e o ponteiro ficam ativos */
  canDraw: boolean;
  onStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
  onClear: () => void;
  onUndo: () => void;
  registerHandlers: (handlers: {
    applyRemoteStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
    applyUndo: (strokeId: string) => void;
    applyClear: () => void;
    /** JPEG do desenho atual com fundo branco, ou null se o canvas estiver vazio */
    snapshot: () => string | null;
  }) => void;
  /** overlays (acerto, resumo do turno) desenhados por cima do canvas */
  children?: ReactNode;
}

// Coordenadas logicas fixas: todo client desenha num quadro 800x600 e escala pro tamanho da
// tela. Sem isso, um traco feito num PC caia fora/torto no canvas menor do celular.
const LOGICAL_W = 800;
const LOGICAL_H = 600;

const COLORS = [
  "#000000",
  "#6b7280",
  "#ffffff",
  "#ef4444",
  "#f43f5e",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#1cb0f6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#fda4af",
  "#78350f",
  "#1c1a2e",
];
const SIZES = [3, 7, 14, 26];
const ERASER = "#ffffff";
const FLUSH_MS = 40;

function drawStroke(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], color: string, width: number) {
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

export function Canvas({ canDraw, onStroke, onClear, onUndo, registerHandlers, children }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [erasing, setErasing] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const drawingRef = useRef(false);
  const currentStrokeIdRef = useRef<string | null>(null);
  const bufferRef = useRef<{ x: number; y: number }[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastFlushRef = useRef(0);
  const strokesRef = useRef<Map<string, LocalStroke>>(new Map());
  const orderRef = useRef<string[]>([]);

  const activeColor = erasing ? ERASER : color;

  function getCtx(): CanvasRenderingContext2D | null {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function wipe(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  function redrawFromState() {
    const ctx = getCtx();
    if (!ctx) return;
    wipe(ctx);
    for (const id of orderRef.current) {
      const stroke = strokesRef.current.get(id);
      if (stroke) drawStroke(ctx, stroke.points, stroke.color, stroke.width);
    }
  }

  useEffect(() => {
    registerHandlers({
      applyRemoteStroke: (strokeId, points, strokeColor, strokeWidth) => {
        const ctx = getCtx();
        if (!ctx) return;
        const existing = strokesRef.current.get(strokeId);
        if (existing) {
          const last = existing.points[existing.points.length - 1];
          const segment = last ? [last, ...points] : points;
          drawStroke(ctx, segment, strokeColor, strokeWidth);
          existing.points.push(...points);
        } else {
          strokesRef.current.set(strokeId, { strokeId, points: [...points], color: strokeColor, width: strokeWidth });
          orderRef.current.push(strokeId);
          drawStroke(ctx, points, strokeColor, strokeWidth);
        }
      },
      applyUndo: (strokeId) => {
        strokesRef.current.delete(strokeId);
        orderRef.current = orderRef.current.filter((id) => id !== strokeId);
        redrawFromState();
      },
      applyClear: () => {
        strokesRef.current.clear();
        orderRef.current = [];
        const ctx = getCtx();
        if (ctx) wipe(ctx);
      },
      snapshot: () => {
        const canvas = canvasRef.current;
        if (!canvas || orderRef.current.length === 0) return null;
        try {
          // copia reduzida com fundo branco (o canvas em si e transparente; o branco vem do CSS)
          const out = document.createElement("canvas");
          out.width = 480;
          out.height = 360;
          const octx = out.getContext("2d");
          if (!octx) return null;
          octx.fillStyle = "#ffffff";
          octx.fillRect(0, 0, out.width, out.height);
          octx.drawImage(canvas, 0, 0, out.width, out.height);
          return out.toDataURL("image/jpeg", 0.82);
        } catch {
          return null;
        }
      },
    });
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
    const ctx = getCtx();
    if (!canvas || !ctx || box.w === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.w * dpr);
    canvas.height = Math.round(box.h * dpr);
    const scale = (box.w * dpr) / LOGICAL_W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    redrawFromState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.w, box.h]);

  function getLogicalPoint(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
    const y = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;
    // 1 casa decimal basta e deixa o payload do socket menor
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }

  function flushBuffer() {
    if (bufferRef.current.length === 0 || !currentStrokeIdRef.current) return;
    onStroke(currentStrokeIdRef.current, bufferRef.current, activeColor, size);
    bufferRef.current = [];
    lastFlushRef.current = Date.now();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const strokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    currentStrokeIdRef.current = strokeId;
    const point = getLogicalPoint(e);
    lastPointRef.current = point;
    bufferRef.current = [point];
    lastFlushRef.current = Date.now();

    const ctx = getCtx();
    if (ctx) drawStroke(ctx, [point], activeColor, size);
    strokesRef.current.set(strokeId, { strokeId, points: [point], color: activeColor, width: size });
    orderRef.current.push(strokeId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || !drawingRef.current) return;
    const point = getLogicalPoint(e);
    const ctx = getCtx();
    const prev = lastPointRef.current;
    if (ctx && prev) drawStroke(ctx, [prev, point], activeColor, size);
    lastPointRef.current = point;
    bufferRef.current.push(point);
    const stroke = strokesRef.current.get(currentStrokeIdRef.current!);
    if (stroke) stroke.points.push(point);

    if (Date.now() - lastFlushRef.current >= FLUSH_MS) flushBuffer();
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    flushBuffer();
    currentStrokeIdRef.current = null;
    lastPointRef.current = null;
  }

  function handleUndoClick() {
    const lastId = orderRef.current[orderRef.current.length - 1];
    if (lastId) {
      strokesRef.current.delete(lastId);
      orderRef.current = orderRef.current.filter((id) => id !== lastId);
      redrawFromState();
    }
    onUndo();
  }

  function handleClearClick() {
    strokesRef.current.clear();
    orderRef.current = [];
    const ctx = getCtx();
    if (ctx) wipe(ctx);
    onClear();
  }

  const toolBtn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-90 sm:h-10 sm:w-10";

  return (
    <div className="flex min-h-0 flex-1 select-none flex-col gap-1.5 sm:gap-2">
      <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="relative overflow-hidden rounded-xl border-2 border-[var(--border)] bg-white shadow-sm sm:rounded-2xl"
          style={{ width: box.w || undefined, height: box.h || undefined }}
        >
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 h-full w-full ${canDraw ? "cursor-crosshair" : ""}`}
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {children}
        </div>
      </div>

      {canDraw && (
        <div className="animate-fade-up flex shrink-0 flex-col gap-1.5 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-1.5 sm:gap-2 sm:p-2">
          {/* paleta: uma linha com scroll horizontal no celular, quebra em linhas no desktop */}
          <div className="no-scrollbar -mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 py-0.5 sm:flex-wrap sm:overflow-visible">
            {COLORS.map((c) => {
              const selected = !erasing && color === c;
              return (
                <button
                  key={c}
                  aria-label={`Cor ${c}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setColor(c);
                    setErasing(false);
                  }}
                  className={`h-7 w-7 shrink-0 rounded-full border-2 transition sm:h-7 sm:w-7 ${
                    selected
                      ? "scale-110 border-[var(--primary)] ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--card)]"
                      : "border-[var(--border)] hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              {SIZES.map((s) => (
                <button
                  key={s}
                  aria-label={`Espessura ${s}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSize(s)}
                  className={`${toolBtn} ${
                    size === s ? "border-[var(--primary)] bg-[var(--primary-tint)]" : "border-[var(--border)]"
                  }`}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: Math.max(4, Math.min(22, s * 0.8)),
                      height: Math.max(4, Math.min(22, s * 0.8)),
                      backgroundColor: erasing ? "var(--fg-muted)" : color === "#ffffff" ? "#d1d5db" : color,
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1">
              <button
                aria-label="Borracha"
                aria-pressed={erasing}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setErasing((v) => !v)}
                className={`${toolBtn} ${
                  erasing
                    ? "border-[var(--primary)] bg-[var(--primary-tint)] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--fg)]"
                }`}
              >
                <Eraser size={16} />
              </button>
              <button
                aria-label="Desfazer"
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
          </div>
        </div>
      )}
    </div>
  );
}
