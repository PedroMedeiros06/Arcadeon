import { useCallback, useSyncExternalStore } from "react";

const EVENT = "race-local-flag";

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeLocalFlag(key: string, value: boolean): void {
  try {
    if (value) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // modo privado/armazenamento bloqueado: vale so ate recarregar
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Flag booleana persistida no localStorage. No SSR devolve `serverValue` (sem hydration mismatch);
 * no client le o valor real depois de montar.
 */
export function useLocalFlag(key: string, serverValue: boolean): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => serverValue
  );
  const set = useCallback((next: boolean) => writeLocalFlag(key, next), [key]);
  return [value, set];
}
