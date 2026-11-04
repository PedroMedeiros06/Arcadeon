import type { SVGProps } from "react";

/** Moeda do Arcadeon: um token dourado compacto, legível de 14 a 24 px. */
export function CoinIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <ellipse cx="12" cy="12.8" rx="8.7" ry="7.2" fill="#D88916" opacity="0.9" />
      <ellipse cx="12" cy="11.2" rx="8.7" ry="7.2" fill="#F7B733" stroke="#B86A12" strokeWidth="1.2" />
      <path d="M8.1 11.2c.8-2.1 2.3-3.2 4.3-3.2 1.4 0 2.6.5 3.5 1.5" stroke="#FFF2B5" strokeWidth="1.25" strokeLinecap="round" opacity="0.9" />
      <path d="M9.1 14.1c.8.7 1.8 1.1 3 1.1 1.8 0 3.2-.8 4-2.2" stroke="#D88916" strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
      <path d="M12.1 9.3v4.2M10.5 10.2c.3-.6.9-.9 1.7-.9 1 0 1.7.5 1.7 1.2 0 .8-.7 1.1-1.8 1.3-1 .2-1.6.5-1.6 1.2 0 .7.7 1.2 1.8 1.2.8 0 1.5-.3 1.8-.9" stroke="#9A5410" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
