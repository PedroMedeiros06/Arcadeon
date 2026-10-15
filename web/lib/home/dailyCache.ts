/**
 * Divide so a busca em andamento: home e barra lateral montam juntas e fazem uma requisicao.
 * Depois que resolve, a proxima montagem busca de novo (a pessoa pode ter jogado o diario).
 */
export function createOnce<T>(fetcher: () => Promise<T>): (key: string) => Promise<T> {
  let pendingKey: string | null = null;
  let pending: Promise<T> | null = null;
  return (key) => {
    if (pending && pendingKey === key) return pending;
    const current = fetcher().finally(() => {
      if (pending === current) {
        pending = null;
        pendingKey = null;
      }
    });
    pending = current;
    pendingKey = key;
    return current;
  };
}
