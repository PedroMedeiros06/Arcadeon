import { ShoppingBag } from "lucide-react";
import { ShopPageContent } from "@/components/shop/ShopPageContent";

export default function ShopPage() {
  return (
    <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]">
            <ShoppingBag className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--fg)]">Loja</h1>
            <p className="text-sm text-[var(--fg-muted)]">Troque suas moedas por avatares e itens</p>
          </div>
        </div>
        <ShopPageContent />
      </div>
    </main>
  );
}
