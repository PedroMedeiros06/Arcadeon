"use client";

import { Volume2, VolumeX } from "lucide-react";
import { BUGGLE_SOUND_MUTED_KEY } from "@/lib/buggle/sound";
import { useLocalFlag } from "@/lib/race/useLocalFlag";

export function SoundToggle() {
  const [muted, setMuted] = useLocalFlag(BUGGLE_SOUND_MUTED_KEY, false);
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Ligar som" : "Desligar som"}
      aria-pressed={!muted}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--border)] bg-[var(--card)] text-[var(--fg-muted)] transition hover:text-[var(--fg)] active:scale-95"
    >
      <Icon size={16} />
    </button>
  );
}
