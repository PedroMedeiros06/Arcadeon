import { Suspense } from "react";
import { CofreGame } from "@/components/cofre/CofreGame";
import { gameMetadata } from "@/lib/seo";

export const metadata = gameMetadata("cofre");

export default function CofrePage() {
  return (
    <div data-game="cofre" className="flex flex-1 flex-col select-none">
      <Suspense>
        <CofreGame />
      </Suspense>
    </div>
  );
}
