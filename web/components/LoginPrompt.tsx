"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { LoginModal } from "./LoginModal";

/** Bloco mostrado no lugar de conteudo que exige conta. */
export function LoginPrompt({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
      <p className="font-display text-xl font-extrabold text-[var(--fg)]">{title}</p>
      <p className="max-w-sm text-sm text-[var(--fg-muted)]">{text}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-2 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
      >
        <LogIn className="h-4 w-4" /> Entrar
      </button>
      <LoginModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
