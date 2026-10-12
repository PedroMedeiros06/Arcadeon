"use client";

import { useEffect } from "react";
import { LogOut } from "lucide-react";

/** Confirmacao de saida padrao dos jogos. Use via useLeaveGuard (lib/useLeaveGuard). */
export function LeaveConfirmModal({
  title,
  message,
  confirmLabel,
  onStay,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onStay: () => void;
  onConfirm: () => void;
}) {
  // Esc = ficar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onStay();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStay]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
      onClick={onStay}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up w-full max-w-sm rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-5 shadow-xl"
      >
        <h2 id="leave-confirm-title" className="font-display text-lg font-extrabold text-[var(--fg)]">
          {title}
        </h2>
        <p className="mt-1.5 text-sm font-medium text-[var(--fg-muted)]">{message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onConfirm}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 text-sm font-extrabold text-[var(--danger)] transition hover:opacity-80"
          >
            <LogOut className="h-4 w-4" /> {confirmLabel}
          </button>
          <button
            type="button"
            autoFocus
            onMouseDown={(e) => e.preventDefault()}
            onClick={onStay}
            className="h-11 rounded-xl border-2 border-[var(--primary-dark)] bg-[var(--primary)] px-5 text-sm font-extrabold text-white shadow-[0_4px_0_var(--primary-dark)] transition active:translate-y-0.5 active:shadow-none"
          >
            Ficar
          </button>
        </div>
      </div>
    </div>
  );
}
