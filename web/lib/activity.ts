import { createClient } from "@/lib/supabase/client";
import { shouldLog, type ActivityGame } from "./activityDedupe";

export type { ActivityGame };

const STORAGE_KEY = "arcadeon_activity_last";
// mesma chave do Letrado anonimo, pra o servidor juntar as duas medicoes
const ANON_KEY_STORAGE = "termo_anon_key";

function anonKey(): string | null {
  try {
    let key = localStorage.getItem(ANON_KEY_STORAGE);
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(ANON_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return null;
  }
}

/** Marca que a pessoa passou pelo jogo hoje. Nunca lanca erro: medicao nao pode quebrar a tela. */
export async function logActivity(game: ActivityGame): Promise<void> {
  try {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      // storage bloqueado: segue sem deduplicar
    }
    const { log, next } = shouldLog(raw, game, Date.now());
    if (!log) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // idem
    }
    await createClient().rpc("log_activity", { p_game: game, p_anon_key: anonKey() });
  } catch {
    // RPC ainda nao existe ou rede caiu: ignora
  }
}
