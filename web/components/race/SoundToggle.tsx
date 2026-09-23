"use client";

import { Volume2, VolumeX } from "lucide-react";
import { SOUND_MUTED_KEY } from "@/lib/race/sound";
import { useLocalFlag } from "@/lib/race/useLocalFlag";

export function SoundToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [muted, setMuted] = useLocalFlag(SOUND_MUTED_KEY, false);
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Ligar som" : "Desligar som"}
      aria-pressed={!muted}
      data-testid="sound-toggle"
      data-muted={muted ? "1" : "0"}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition active:scale-95 ${
        variant === "dark"
          ? "bg-black/25 text-white/80 hover:text-white"
          : "border-2 border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
      }`}
    >
      <Icon size={16} />
    </button>
  );
}
