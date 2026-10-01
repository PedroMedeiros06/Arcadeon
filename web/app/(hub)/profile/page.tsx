import type { Metadata } from "next";
import { ProfilePageContent } from "@/components/profile/ProfilePageContent";

// pagina pessoal: fora da busca
export const metadata: Metadata = { title: "Perfil", robots: { index: false, follow: false } };

export default function ProfilePage() {
  return (
    <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <ProfilePageContent />
      </div>
    </main>
  );
}
