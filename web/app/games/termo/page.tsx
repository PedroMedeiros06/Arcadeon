import Link from "next/link";
import { TermoGame } from "@/components/termo/TermoGame";

export default function TermoPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b-4 border-[var(--border)] bg-[var(--card)] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-bold text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Hub
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-[var(--fg)]">
            <span className="text-2xl">🟩</span> Termo
          </h1>
          <span className="w-12" />
        </div>
      </header>

      <TermoGame />
    </div>
  );
}
