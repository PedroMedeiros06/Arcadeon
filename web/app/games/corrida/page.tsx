import { Suspense } from "react";
import { RaceGame } from "@/components/race/RaceGame";

export default function CorridaPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense>
        <RaceGame />
      </Suspense>
    </div>
  );
}
