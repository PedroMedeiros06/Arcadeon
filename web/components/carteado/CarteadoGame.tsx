"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GameHeader } from "@/components/GameHeader";
import { OnlineGame } from "./OnlineGame";
import { PracticeScreen } from "./PracticeScreen";

export function CarteadoGame() {
  const joinCode = useSearchParams().get("join");
  const [practice, setPractice] = useState(false);

  if (practice) {
    return (
      <>
        <GameHeader slug="carteado" />
        <PracticeScreen onExit={() => setPractice(false)} />
      </>
    );
  }
  return <OnlineGame joinCode={joinCode} onPractice={() => setPractice(true)} />;
}
