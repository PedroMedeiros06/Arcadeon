import { OG_CONTENT_TYPE, OG_SIZE, renderGameOgImage } from "@/lib/ogImage";

export const alt = "Rabiscado no Arcadeon";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderGameOgImage("drawit");
}
