import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Mesmo icone de app/icon.tsx, sem cantos arredondados (o iOS arredonda sozinho).
export default async function AppleIcon() {
  const buf = await readFile(join(process.cwd(), "public/Logo@4x.png"));
  const src = `data:image/png;base64,${buf.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c0b16",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={136} height={94} alt="" />
      </div>
    ),
    size,
  );
}
