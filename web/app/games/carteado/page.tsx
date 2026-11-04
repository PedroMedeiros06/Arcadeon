import { Suspense } from "react";
import { CarteadoGame } from "@/components/carteado/CarteadoGame";
import { gameMetadata } from "@/lib/seo";

export const metadata = gameMetadata("carteado");

export default function CarteadoPage() {
  return (
    <div data-game="carteado" className="flex flex-1 flex-col select-none">
      <Suspense>
        <CarteadoGame />
      </Suspense>
    </div>
  );
}
