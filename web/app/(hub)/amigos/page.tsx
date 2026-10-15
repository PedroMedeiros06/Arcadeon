import type { Metadata } from "next";
import { FriendsPageContent } from "@/components/social/FriendsPageContent";

// pagina pessoal: fora da busca
export const metadata: Metadata = { title: "Amigos", robots: { index: false, follow: false } };

export default function FriendsPage() {
  return (
    <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--fg)] sm:text-3xl">Amigos</h1>
        <FriendsPageContent />
      </div>
    </main>
  );
}
