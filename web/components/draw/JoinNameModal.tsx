"use client";

import { useState } from "react";

interface JoinNameModalProps {
  onConfirm: (name: string) => void;
  joinError: string | null;
}

export function JoinNameModal({ onConfirm, joinError }: JoinNameModalProps) {
  const [name, setName] = useState("");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-xl font-extrabold text-[var(--fg)]">Entrar na sala</h2>
      <p className="text-sm text-[var(--fg-muted)]">Como voce quer ser chamado?</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Seu nome"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
        }}
        className="w-64 rounded-lg border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2 text-center text-[var(--fg)]"
      />
      {joinError && <p className="text-sm font-semibold text-[var(--danger)]">{joinError}</p>}
      <button
        onMouseDown={(e) => e.preventDefault()}
        disabled={!name.trim()}
        onClick={() => onConfirm(name.trim())}
        className="rounded-lg border-2 border-[var(--accent-dark)] bg-[var(--accent)] px-6 py-2 font-bold text-white shadow-[0_4px_0_var(--accent-dark)] disabled:opacity-50"
      >
        Entrar
      </button>
    </div>
  );
}
