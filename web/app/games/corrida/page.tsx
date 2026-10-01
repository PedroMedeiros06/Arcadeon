import { Suspense } from "react";
import { RaceGame } from "@/components/race/RaceGame";
import { gameMetadata } from "@/lib/seo";

export const metadata = gameMetadata("corrida");

export default function CorridaPage() {
  return (
    <div data-game="corrida" className="flex flex-1 flex-col">
      <Suspense>
        <RaceGame />
      </Suspense>
    </div>
  );
}
