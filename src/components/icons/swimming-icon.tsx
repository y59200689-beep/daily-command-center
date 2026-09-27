import type { SVGProps } from "react";

export function SwimmingIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="17" cy="6" r="2" />
      <path d="m4 12 5-5 5 4-3 4M9 7 6 4H3" />
      <path d="M2 16c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 21c2 0 2 1 4 1s2-1 4-1 2 1 4 1 2-1 4-1 2 1 4 1" />
    </svg>
  );
}
