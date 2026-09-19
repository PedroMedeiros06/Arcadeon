import { Package } from "lucide-react";
import { InventoryPageContent } from "@/components/inventory/InventoryPageContent";

export default function InventoryPage() {
  return (
    <main className="w-full flex-1 px-6 py-8">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-tint)] text-[var(--primary)]">
          <Package className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[var(--fg)]">Inventário</h2>
          <p className="text-sm font-medium text-[var(--fg-muted)]">Seus avatares e a loja do Arcadeon</p>
        </div>
      </div>

      <InventoryPageContent />
    </main>
  );
}
