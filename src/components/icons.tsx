type IconProps = { size?: number; className?: string };

function Svg({
  size = 24,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Memory: a brain made of two lobes. */
export function MemoryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5a3 3 0 0 0-5.6-1.5A3 3 0 0 0 3.6 8 3.5 3.5 0 0 0 4 14.6 3 3 0 0 0 8 19a2.8 2.8 0 0 0 4 .4" />
      <path d="M12 5a3 3 0 0 1 5.6-1.5A3 3 0 0 1 20.4 8a3.5 3.5 0 0 1-.4 6.6A3 3 0 0 1 16 19a2.8 2.8 0 0 1-4 .4" />
      <path d="M12 5v14.4" />
      <path d="M8.5 9.5h1.2M14.3 13.5h1.2" />
    </Svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />
    </Svg>
  );
}

/** Action: a squad of three figures charging forward. */
export function CrowdIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5.5" r="2.2" />
      <path d="M8.5 13a3.5 3.5 0 0 1 7 0v1.5h-7z" />
      <circle cx="5.5" cy="9.5" r="1.8" />
      <path d="M2.5 16a3 3 0 0 1 5.4-1.8" />
      <circle cx="18.5" cy="9.5" r="1.8" />
      <path d="M21.5 16a3 3 0 0 0-5.4-1.8" />
      <path d="M7 20h10" />
    </Svg>
  );
}

/** Puzzle: a cube with its faces split into a grid. */
export function PuzzleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
      <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" />
      <path d="M7.75 4.75 16.25 9.25M16.25 4.75 7.75 9.25" />
      <path d="M3.5 12l8.5 4.5 8.5-4.5" />
      <path d="M7.75 9.25v10M16.25 9.25v10" />
    </Svg>
  );
}

/** Adventure: a compass with its needle pointing the way. */
export function AdventureIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
    </Svg>
  );
}

/** Kingdom: a castle with three towers. */
export function CastleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 21V9h4v3h2V9h6v3h2V9h4v12z" />
      <path d="M9 9V5l3-2 3 2v4" />
      <path d="M10.5 21v-4a1.5 1.5 0 0 1 3 0v4" />
    </Svg>
  );
}
