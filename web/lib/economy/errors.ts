/**
 * Mensagem pra mostrar quando uma RPC falha. So passa o texto que veio de uma regra do servidor
 * (RAISE, dado ou restricao invalida); rede e infraestrutura chegam em ingles e viram o texto padrao.
 */
export function rpcErrorMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  const code = error?.code ?? "";
  const fromRule = code === "P0001" || code.startsWith("22") || code.startsWith("23");
  return fromRule && error?.message ? error.message : fallback;
}
