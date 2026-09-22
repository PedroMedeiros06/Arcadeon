import { Suspense } from "react";
import { DrawGame } from "@/components/draw/DrawGame";

export default function DrawItPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense>
        <DrawGame />
      </Suspense>
    </div>
  );
}
