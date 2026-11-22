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

/** Profile overview: a person. */
export function PersonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Svg>
  );
}

/** Wallet: a wallet with its clasp. */
export function WalletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" />
      <path d="M20 11h-4a2 2 0 0 0 0 4h4" />
    </Svg>
  );
}

/** Shop: a shopping bag. */
export function BagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 8h14l-1 13H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </Svg>
  );
}

/** Settings: a gear. */
export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </Svg>
  );
}

/** Edit: a pencil. */
export function PencilIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </Svg>
  );
}

/** A player's public page, as others see it: an eye. */
export function EyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

/** Leaderboard: a trophy cup. */
export function TrophyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M9 20h6M10 17h4" />
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

/** API keys: a key. */
export function KeyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7M16 7l2.5 2.5M14 9l2 2" />
    </Svg>
  );
}
