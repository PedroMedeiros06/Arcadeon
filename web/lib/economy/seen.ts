const KEY = "arcadeon_economy_seen";

/**
 * Se este navegador ja viu missoes ou sequencia. Sem isso a home nao mostra esqueleto:
 * enquanto o banco nao tem as RPCs, o esqueleto so piscaria e a pagina pularia.
 */
export function wasSeen(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    return storage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markSeen(storage: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(KEY, "1");
  } catch {
    // storage bloqueado: a home so perde o esqueleto
  }
}
