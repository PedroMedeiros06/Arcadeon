import { Suspense } from "react";
import { NoveGame } from "@/components/nove/NoveGame";
import { gameMetadata } from "@/lib/seo";

export const metadata = gameMetadata("nove");

export default function NovePage() {
  return (
    <div data-game="nove" className="flex flex-1 flex-col select-none">
      <Suspense>
        <NoveGame />
      </Suspense>
    </div>
  );
}
