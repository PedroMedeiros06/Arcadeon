import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getGame } from "./games";
import { GAME_SEO } from "./seo";

// Cartao de compartilhamento (WhatsApp, Discord, Google). Gerado no build, 1200x630.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const logo = readFile(join(process.cwd(), "public/Logo@4x.png")).then(
  (buf) => `data:image/png;base64,${buf.toString("base64")}`,
);

export async function renderOgImage({
  title,
  text,
  accent,
  chips = ["Grátis", "No navegador", "Com amigos"],
}: {
  title: string;
  text: string;
  accent: string;
  chips?: string[];
}) {
  const logoSrc = await logo;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: `linear-gradient(135deg, #0c0b16 0%, #1d1640 60%, ${accent} 140%)`,
          borderTop: `14px solid ${accent}`,
          color: "#f3f2fb",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={116} height={80} alt="" />
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>Arcadeon</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>{title}</span>
          <span style={{ fontSize: 34, color: "#c9c4ec", lineHeight: 1.3, maxWidth: 980 }}>{text}</span>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {chips.map((chip) => (
            <span
              key={chip}
              style={{
                fontSize: 26,
                fontWeight: 700,
                padding: "8px 22px",
                borderRadius: 999,
                border: `3px solid ${accent}`,
                color: "#f3f2fb",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/** Cartao de um jogo, usado pelos `opengraph-image.tsx` em `app/games/<slug>/`. */
export function renderGameOgImage(slug: string) {
  const game = getGame(slug);
  const seo = GAME_SEO[slug];
  const chips = game.multiplayer ? ["Grátis", "No navegador", `${game.players} jogadores`] : ["Grátis", "No navegador", "Palavra do dia"];
  return renderOgImage({ title: game.title, text: seo.tagline, accent: seo.color, chips });
}
