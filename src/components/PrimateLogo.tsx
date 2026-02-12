interface PrimateLogoProps {
  className?: string;
}

export function PrimateLogo({ className = "h-6 w-6" }: PrimateLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Primate silhouette inspired by WaNPRC logo */}
      <circle cx="50" cy="50" r="48" fill="currentColor" opacity="0.15" />
      {/* Body */}
      <ellipse cx="45" cy="58" rx="14" ry="18" fill="currentColor" />
      {/* Head */}
      <circle cx="42" cy="34" r="12" fill="currentColor" />
      {/* Snout */}
      <ellipse cx="36" cy="38" rx="5" ry="4" fill="currentColor" />
      {/* Ear */}
      <circle cx="50" cy="27" r="5" fill="currentColor" />
      {/* Front leg */}
      <rect x="34" y="65" width="5" height="16" rx="2" fill="currentColor" transform="rotate(-5 34 65)" />
      {/* Back leg */}
      <rect x="50" y="62" width="5" height="18" rx="2" fill="currentColor" transform="rotate(10 50 62)" />
      {/* Tail */}
      <path
        d="M58 50 Q72 35 78 28 Q82 24 80 20"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
