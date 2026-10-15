import type { StatusInput } from "./rules.ts";

/** Guarda o status do proprio usuario e avisa quem precisa reagir (o aviso de convite some ao comecar a partida). */
export function createStatusStore() {
  let current: StatusInput | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => current,
    set(s: StatusInput) {
      current = s;
      emit();
    },
    clear() {
      current = null;
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
