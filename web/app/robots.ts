import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // paginas pessoais, rotas de login e telas de teste nao devem aparecer na busca
      disallow: ["/profile", "/inventory", "/auth/", "/games/buggle/mock"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
