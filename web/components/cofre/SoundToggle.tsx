"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useLocalFlag } from "@/lib/race/useLocalFlag";
import { SOUND_MUTED_KEY } from "@/lib/cofre/sound";

export function SoundToggle() {
  const [muted, setMuted] = useLocalFlag(SOUND_MUTED_KEY, false);
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Ligar som" : "Desligar som"}
      aria-pressed={!muted}
      className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] transition hover:text-[var(--fg)] active:scale-95"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
