import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/ogImage";

export const alt = "Arcadeon: jogos online grátis com amigos";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    title: "Jogos online com amigos",
    text: "Letrado, Buggle, Rabiscado e Corrida do Conhecimento. Crie uma sala e jogue no navegador.",
    accent: "#8b6cff",
  });
}
