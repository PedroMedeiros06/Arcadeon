import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// O logo e largo (1312x904); aqui vira um quadrado escuro com o logo centralizado.
export default async function Icon() {
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
          borderRadius: 112,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={380} height={262} alt="" />
      </div>
    ),
    size,
  );
}
