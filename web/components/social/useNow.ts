"use client";

import { useEffect, useState } from "react";

/** Hora atual que avanca sozinha; o "offline" dos amigos e derivado dela. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
