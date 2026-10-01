import { gameMetadata } from "@/lib/seo";

// So metadata de busca; a pagina do Letrado continua com a sessao Letrado.
export const metadata = gameMetadata("termo");

export default function TermoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
