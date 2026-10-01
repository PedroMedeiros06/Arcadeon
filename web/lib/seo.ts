import type { Metadata } from "next";
import { getGame } from "./games";

export const SITE_NAME = "Arcadeon";

// Endereco publico do site. Na Vercel, VERCEL_PROJECT_PRODUCTION_URL ja vem preenchida;
// NEXT_PUBLIC_SITE_URL tem prioridade pra quando houver dominio proprio.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_DESCRIPTION =
  "Arcadeon é uma central de jogos online grátis no navegador: Letrado (palavra do dia), Buggle, Rabiscado e Corrida do Conhecimento. Jogue sozinho ou crie uma sala com amigos, sem instalar nada.";

/** Texto de busca de cada jogo. O titulo e a descricao viram <title>, meta description e cartao de compartilhamento. */
export const GAME_SEO: Record<string, { title: string; description: string; keywords: string[]; color: string; tagline: string }> = {
  termo: {
    color: "#2fbf6c",
    tagline: "Descubra a palavra de 5 letras em 6 tentativas. Uma nova todo dia.",
    title: "Letrado — adivinhe a palavra do dia",
    description:
      "Letrado é o jogo de palavras diário do Arcadeon: descubra a palavra de 5 letras em 6 tentativas, jogue os modos Duplo, Quádruplo, Contra o Tempo, Vilão e Infinito, e mantenha sua sequência.",
    keywords: ["letrado", "palavra do dia", "jogo de palavras", "adivinhar palavra", "termo", "wordle em português"],
  },
  buggle: {
    color: "#2ea6ee",
    tagline: "Caça-palavras em tempo real. Ache mais palavras que seus amigos.",
    title: "Buggle — caça-palavras online com amigos",
    description:
      "Buggle é um caça-palavras em tempo real: forme o máximo de palavras no tabuleiro de letras antes do tempo acabar. Crie uma sala e jogue com até 24 amigos.",
    keywords: ["buggle", "caça-palavras online", "boggle online", "jogo de palavras multiplayer", "jogo com amigos"],
  },
  drawit: {
    color: "#f0608f",
    tagline: "Um desenha, o resto adivinha. Desenhe mal, ria bastante.",
    title: "Rabiscado — desenhe e adivinhe com amigos",
    description:
      "Rabiscado é o jogo de desenhar e adivinhar do Arcadeon: um desenha, o resto chuta a palavra. Crie uma sala grátis e jogue online com até 16 amigos.",
    keywords: ["rabiscado", "jogo de desenhar e adivinhar", "desenhar online com amigos", "pictionary online", "gartic"],
  },
  corrida: {
    color: "#f4a12a",
    tagline: "Quiz em tempo real: quem sabe mais chega primeiro.",
    title: "Corrida do Conhecimento — quiz online multiplayer",
    description:
      "Corrida do Conhecimento é um quiz de perguntas e respostas em tempo real: responda rápido, acelere seu carro e chegue primeiro. Jogue online com até 16 amigos.",
    keywords: ["corrida do conhecimento", "quiz online", "perguntas e respostas", "quiz multiplayer", "jogo de conhecimentos gerais"],
  },
};

/** Metadata da pagina de um jogo. Usar em `export const metadata = gameMetadata("slug")`. */
export function gameMetadata(slug: string): Metadata {
  const seo = GAME_SEO[slug];
  const game = getGame(slug);
  const path = `/games/${slug}`;
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: SITE_NAME,
      locale: "pt_BR",
      title: `${seo.title} · ${SITE_NAME}`,
      description: seo.description,
    },
    twitter: { card: "summary_large_image", title: `${game.title} · ${SITE_NAME}`, description: seo.description },
  };
}

/** JSON-LD: o site e a lista de jogos. Ajuda o Google a mostrar o nome "Arcadeon" e ligar os jogos a ele. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: "pt-BR",
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "ItemList",
        name: `Jogos do ${SITE_NAME}`,
        itemListElement: Object.keys(GAME_SEO).map((slug, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "VideoGame",
            name: getGame(slug).title,
            url: `${SITE_URL}/games/${slug}`,
            description: GAME_SEO[slug].description,
            inLanguage: "pt-BR",
            gamePlatform: "Navegador",
            applicationCategory: "Game",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
            isPartOf: { "@id": `${SITE_URL}/#website` },
          },
        })),
      },
    ],
  };
}
