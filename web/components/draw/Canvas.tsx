"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Undo2 } from "lucide-react";

interface LocalStroke {
  strokeId: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface CanvasProps {
  isDrawer: boolean;
  onStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
  onClear: () => void;
  onUndo: () => void;
  registerHandlers: (handlers: {
    applyRemoteStroke: (strokeId: string, points: { x: number; y: number }[], color: string, width: number) => void;
    applyUndo: (strokeId: string) => void;
    applyClear: () => void;
  }) => void;
}

const COLORS = [
  "#000000",
  "#1c1a2e",
  "#6b7280",
  "#ffffff",
  "#ef4444",
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
  "#f43f5e",
  "#78350f",
  "#fda4af",
];
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

export function Canvas({ isDrawer, onStroke, onClear, onUndo, registerHandlers }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);

  const drawingRef = useRef(false);
  const currentStrokeIdRef = useRef<string | null>(null);
  const bufferRef = useRef<{ x: number; y: number }[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastFlushRef = useRef(0);
  const strokesRef = useRef<Map<string, LocalStroke>>(new Map());
  const orderRef = useRef<string[]>([]);

  function redrawFromState() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const id of orderRef.current) {
      const stroke = strokesRef.current.get(id);
      if (stroke) drawStroke(ctx, stroke.points, stroke.color, stroke.width);
    }
  }

  useEffect(() => {
    registerHandlers({
      applyRemoteStroke: (strokeId, points, strokeColor, strokeWidth) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
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
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawFromState();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getRelativePoint(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function flushBuffer() {
    if (bufferRef.current.length === 0 || !currentStrokeIdRef.current) return;
    onStroke(currentStrokeIdRef.current, bufferRef.current, color, width);
    bufferRef.current = [];
    lastFlushRef.current = Date.now();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const strokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    currentStrokeIdRef.current = strokeId;
    const point = getRelativePoint(e);
    lastPointRef.current = point;
    bufferRef.current = [point];
    lastFlushRef.current = Date.now();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) drawStroke(ctx, [point], color, width);
    strokesRef.current.set(strokeId, { strokeId, points: [point], color, width });
    orderRef.current.push(strokeId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawer || !drawingRef.current) return;
    const point = getRelativePoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const prev = lastPointRef.current;
    if (ctx && prev) drawStroke(ctx, [prev, point], color, width);
    lastPointRef.current = point;
    bufferRef.current.push(point);
    const stroke = strokesRef.current.get(currentStrokeIdRef.current!);
    if (stroke) stroke.points.push(point);

    if (Date.now() - lastFlushRef.current >= FLUSH_MS) flushBuffer();
  }

  function handlePointerUp() {
    if (!isDrawer || !drawingRef.current) return;
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
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-2">
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden rounded-xl border-2 border-[var(--border)] bg-white sm:rounded-2xl">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {isDrawer && (
        <div className="flex shrink-0 flex-col gap-1.5 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:px-3 sm:py-2">
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setColor(c)}
                className={`h-5 w-5 shrink-0 rounded-full border-2 transition sm:h-6 sm:w-6 ${
                  color === c ? "border-[var(--primary)] scale-110" : "border-[var(--border)]"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={2}
              max={16}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-16 accent-[var(--primary)]"
            />
            <div className="ml-auto flex gap-2 sm:ml-0">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleUndoClick}
                className="flex items-center gap-1 rounded-lg border-2 border-[var(--border)] px-2 py-1 text-xs font-bold text-[var(--fg)] transition hover:border-[var(--primary)] sm:px-2.5 sm:py-1.5"
              >
                <Undo2 size={13} />
                <span className="hidden sm:inline">Desfazer</span>
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearClick}
                className="flex items-center gap-1 rounded-lg border-2 border-[var(--border)] px-2 py-1 text-xs font-bold text-[var(--fg)] transition hover:border-[var(--danger)] sm:px-2.5 sm:py-1.5"
              >
                <Eraser size={13} />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
