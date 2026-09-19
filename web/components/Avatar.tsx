import Image from "next/image";

const SIZES = {
  sm: "h-6 w-6 text-xs",
  md: "h-9 w-9 text-base",
  lg: "h-16 w-16 text-3xl",
} as const;

const PIXELS = { sm: 24, md: 36, lg: 64 } as const;

export function Avatar({
  emoji,
  bgColor,
  imageUrl,
  fallbackLetter,
  size = "md",
}: {
  emoji?: string | null;
  bgColor?: string | null;
  imageUrl?: string | null;
  fallbackLetter?: string;
  size?: keyof typeof SIZES;
}) {
  if (imageUrl) {
    return (
      <span className={`relative block shrink-0 overflow-hidden rounded-full ${SIZES[size]}`}>
        <Image src={imageUrl} alt="" fill sizes={`${PIXELS[size]}px`} className="object-cover" />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${SIZES[size]}`}
      style={{ backgroundColor: emoji ? bgColor ?? "var(--primary)" : "var(--primary)" }}
    >
      {emoji ?? fallbackLetter ?? "?"}
    </span>
  );
}
