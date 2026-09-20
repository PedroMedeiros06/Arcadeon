"use client";

interface RoundCountdownProps {
  countdown: number;
}

export function RoundCountdown({ countdown }: RoundCountdownProps) {
  return (
    <div
      className="flex flex-1 items-center justify-center bg-[var(--bg)]"
      style={countdown <= 0 ? { animation: "countdownFadeOut 0.9s ease-in forwards" } : undefined}
    >
      <span
        key={countdown}
        className="text-[10rem] font-black text-[var(--primary)]"
        style={{ animation: "countdownPop 0.8s ease-out" }}
      >
        {countdown > 0 ? countdown : "Vai!"}
      </span>
    </div>
  );
}
