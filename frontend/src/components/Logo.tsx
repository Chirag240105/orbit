import { useId } from "react";

/**
 * The ORBIT mark: a planet with a tilted ring and a node riding the ring.
 * The ring's back half is drawn before the planet and its front half after it,
 * so the ring reads as wrapping around the planet rather than lying on top.
 */
export function OrbitMark({ size = 32, className }: { size?: number; className?: string }) {
  const clip = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <defs>
        {/* Clip that keeps only the ring's front (lower) half. */}
        <clipPath id={clip}><rect x="0" y="16" width="32" height="16" transform="rotate(-24 16 16)" /></clipPath>
      </defs>
      <g transform="rotate(-24 16 16)">
        <ellipse cx="16" cy="16" rx="14" ry="5.2" style={{ stroke: "var(--color-nebula)" }} strokeOpacity="0.55" strokeWidth="1.6" />
      </g>
      <circle cx="16" cy="16" r="7.2" style={{ fill: "var(--color-nebula)" }} />
      <path d="M11.4 13.2a5.4 5.4 0 0 1 6.6-3.1" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.4" strokeLinecap="round" />
      <g clipPath={`url(#${clip})`}>
        <g transform="rotate(-24 16 16)">
          <ellipse cx="16" cy="16" rx="14" ry="5.2" style={{ stroke: "var(--color-text)" }} strokeWidth="1.8" />
        </g>
      </g>
      <circle cx="27.3" cy="15.2" r="2.6" style={{ fill: "var(--color-accent)", stroke: "var(--color-bg)" }} strokeWidth="1.2" />
    </svg>
  );
}

/** Mark plus wordmark, for the navigation rail and the sign-in screen. */
export function Logo({ size = 30, tagline }: { size?: number; tagline?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <OrbitMark size={size} />
      <span className="leading-none">
        <span className="block font-wordmark text-[1.08em] font-semibold tracking-[0.06em] text-text">ORBIT</span>
        {tagline && <span className="mt-1 block text-[11px] tracking-normal text-muted">{tagline}</span>}
      </span>
    </span>
  );
}

/** Small orbit ring with a travelling node, the app's mark for "this is active". */
export function OrbitRing({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.2" />
      <g className="orbit-node"><circle cx="12" cy="2" r="2.1" fill="currentColor" /></g>
    </svg>
  );
}
