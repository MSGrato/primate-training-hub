import { useId } from "react";

interface PrimateLogoProps {
  className?: string;
}

export function PrimateLogo({ className = "h-6 w-6" }: PrimateLogoProps) {
  const clipId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Navy/purple circle background */}
      <circle cx="50" cy="50" r="48" fill="#2D2B6B" />

      {/* Gold hill/ground clipped to circle */}
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <path
        d="M2 75 Q25 58 50 65 Q75 58 98 75 L98 100 L2 100 Z"
        fill="#C4AD6E"
        clipPath={`url(#${clipId})`}
      />

      {/* White macaque silhouette - walking profile facing right with curled tail */}
      <g fill="white">
        {/* Tail */}
        <path
          d="M18 38 Q12 30 14 22 Q16 16 20 18 Q18 24 20 30 Q22 36 24 40"
          fill="white"
        />
        {/* Body */}
        <ellipse cx="42" cy="45" rx="20" ry="14" />
        {/* Head */}
        <circle cx="66" cy="36" r="11" />
        {/* Snout/muzzle */}
        <ellipse cx="75" cy="39" rx="5" ry="4" />
        {/* Brow ridge */}
        <path d="M60 30 Q66 26 74 30 L74 33 Q66 29 60 33 Z" />
        {/* Ear (small bump) */}
        <circle cx="60" cy="28" r="3.5" />
        {/* Neck */}
        <path d="M56 40 Q60 44 58 48 L52 46 Q54 42 56 40" />
        {/* Front left leg (forward) */}
        <path d="M54 54 L58 68 Q60 72 58 74 L56 74 Q55 72 55 68 L52 56 Z" />
        {/* Front right leg (back) */}
        <path d="M48 55 L46 68 Q45 72 43 74 L41 74 Q42 72 42 68 L44 56 Z" />
        {/* Rear left leg (forward, stride) */}
        <path d="M30 52 L34 66 Q36 72 34 74 L32 74 Q31 72 31 66 L28 54 Z" />
        {/* Rear right leg (back, stride) */}
        <path d="M24 50 L18 64 Q16 70 18 74 L20 74 Q19 70 20 66 L26 52 Z" />
        {/* Chest */}
        <ellipse cx="56" cy="48" rx="6" ry="8" />
        {/* Hip */}
        <ellipse cx="28" cy="46" rx="7" ry="9" />
      </g>
    </svg>
  );
}
