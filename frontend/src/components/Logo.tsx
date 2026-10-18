import { useId } from "react";
import { cx } from "./ui";

/** ORBIT mark: a compute die (the model) with an orbit ring and a satellite (the agent) passing in front of it.
 *  Original artwork in NVIDIA green; it does not reproduce NVIDIA's own logo. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cx("shrink-0", className)}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9be22d" />
          <stop offset="1" stopColor="#5a9400" />
        </linearGradient>
        {/* front half of the ring, in the ring's rotated frame */}
        <clipPath id={`f${id}`}><rect x="0" y="16" width="32" height="16" /></clipPath>
        <clipPath id={`c${id}`}><rect x="8.5" y="8.5" width="15" height="15" rx="3.6" /></clipPath>
      </defs>
      <g transform="rotate(-28 16 16)">
        <ellipse cx="16" cy="16" rx="14.2" ry="6" fill="none" stroke={`url(#g${id})`} strokeWidth="2" opacity="0.55" />
      </g>
      <rect x="9.5" y="9.5" width="13" height="13" rx="3.2" fill={`url(#g${id})`} />
      <rect x="13" y="13" width="6" height="6" rx="1.4" fill="var(--color-bg)" />
      <rect x="14.9" y="14.9" width="2.2" height="2.2" rx=".5" fill="#76b900" />
      <g clipPath={`url(#c${id})`}>
        <g transform="rotate(-28 16 16)">
          <ellipse cx="16" cy="16" rx="14.2" ry="6" fill="none" stroke="var(--color-bg)" strokeWidth="4.4" clipPath={`url(#f${id})`} />
        </g>
      </g>
      <g transform="rotate(-28 16 16)">
        <g clipPath={`url(#f${id})`}>
          <ellipse cx="16" cy="16" rx="14.2" ry="6" fill="none" stroke={`url(#g${id})`} strokeWidth="2" />
        </g>
        <circle cx="7.2" cy="20.7" r="2.4" fill="var(--color-text)" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8" />
      <span className="text-[1.05rem] font-semibold tracking-[0.22em]">ORB<span className="text-accent">IT</span></span>
    </span>
  );
}
