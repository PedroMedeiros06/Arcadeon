import Link from "next/link";
import Image from "next/image";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0c0b16]">
        <Image src="/Logo@4x.png" alt="" width={96} height={96} className="h-12 w-12 object-contain" />
      </span>
      <div className="flex flex-col gap-2">
        <p className="font-mono text-sm font-bold tracking-widest text-[var(--primary)]">GAME OVER · 404</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--fg)]">Essa fase não existe</h1>
        <p className="max-w-sm font-medium text-[var(--fg-muted)]">
          O endereço pode ter mudado ou foi digitado errado. Volte ao hub e escolha outro jogo.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-2xl border-b-4 border-[var(--primary-dark)] bg-[var(--primary)] px-6 py-3 text-sm font-extrabold text-white transition hover:brightness-110 active:translate-y-1 active:border-b-2"
      >
        <Home className="h-4 w-4" /> Voltar ao hub
      </Link>
    </main>
  );
}
