"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "signin") {
      // email ou nome de usuario: resolvido no servidor (/auth/login)
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoading(false);
        setError(data.error ?? "Erro ao entrar");
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      onClose();
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    onClose();
  }

  async function handleOAuth(provider: "google" | "github") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border-2 border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_10px_0_var(--border)] animate-[scaleIn_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg)] hover:text-[var(--fg)]"
          aria-label="Fechar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <div className="mb-2 flex justify-center">
          <span className="text-4xl">🎮</span>
        </div>

        <h2 className="mb-1 text-center text-2xl font-extrabold tracking-tight text-[var(--fg)]">
          {mode === "signin" ? "Bem-vindo de volta" : "Crie sua conta"}
        </h2>
        <p className="mb-6 text-center text-sm font-medium text-[var(--fg-muted)]">
          {mode === "signin" ? "Entre para continuar jogando" : "Leva menos de um minuto"}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                title="Apenas letras, numeros e underscore"
                placeholder="Nome de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--fg)] outline-none transition focus:border-[var(--primary)] focus:bg-[var(--card)]"
              />
            </div>
          )}

          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4h16v16H4z" opacity="0" />
              <path d="M22 6 12 13 2 6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 6h20v12H2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type={mode === "signin" ? "text" : "email"}
              required
              autoComplete={mode === "signin" ? "username" : "email"}
              placeholder={mode === "signin" ? "Email ou nome de usuario" : "Email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--fg)] outline-none transition focus:border-[var(--primary)] focus:bg-[var(--card)]"
            />
          </div>

          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] py-3 pl-11 pr-4 text-sm font-medium text-[var(--fg)] outline-none transition focus:border-[var(--primary)] focus:bg-[var(--card)]"
            />
          </div>

          {error && (
            <p className="rounded-xl border-2 border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-4 py-3 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2 disabled:opacity-50"
          >
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Cadastrar"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[var(--fg-muted)]">
          <div className="h-0.5 flex-1 bg-[var(--border)]" />
          <span className="text-xs font-bold uppercase tracking-wider">ou</span>
          <div className="h-0.5 flex-1 bg-[var(--border)]" />
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => handleOAuth("google")}
            className="flex items-center justify-center gap-2.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-bold text-[var(--fg)] transition hover:bg-[var(--bg)] active:translate-y-0.5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continuar com Google
          </button>
          <button
            onClick={() => handleOAuth("github")}
            className="flex items-center justify-center gap-2.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-bold text-[var(--fg)] transition hover:bg-[var(--bg)] active:translate-y-0.5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.5 0 12.3c0 5.44 3.44 10.05 8.2 11.68.6.11.82-.27.82-.6 0-.29-.01-1.06-.02-2.08-3.34.75-4.04-1.66-4.04-1.66-.55-1.43-1.33-1.82-1.33-1.82-1.09-.77.08-.75.08-.75 1.2.09 1.84 1.26 1.84 1.26 1.07 1.87 2.8 1.33 3.49 1.02.11-.79.42-1.33.76-1.64-2.66-.31-5.47-1.37-5.47-6.08 0-1.34.46-2.44 1.23-3.3-.12-.31-.53-1.56.12-3.25 0 0 1-.33 3.3 1.26a11.2 11.2 0 0 1 6 0c2.28-1.59 3.29-1.26 3.29-1.26.65 1.69.24 2.94.12 3.25.77.86 1.23 1.96 1.23 3.3 0 4.72-2.81 5.76-5.49 6.07.43.38.81 1.13.81 2.29 0 1.65-.02 2.98-.02 3.39 0 .33.22.72.83.6C20.57 22.34 24 17.73 24 12.3 24 5.5 18.63 0 12 0z" />
            </svg>
            Continuar com GitHub
          </button>
        </div>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-sm font-medium text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
        >
          {mode === "signin" ? (
            <>Não tem conta? <span className="font-extrabold text-[var(--accent)]">Cadastre-se</span></>
          ) : (
            <>Já tem conta? <span className="font-extrabold text-[var(--accent)]">Entrar</span></>
          )}
        </button>
      </div>
    </div>
  );
}
