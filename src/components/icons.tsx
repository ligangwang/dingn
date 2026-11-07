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

/** Logic: an interlocking puzzle piece. */
export function LogicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 8h3.2a2 2 0 1 1 3.6 0H15v3.2a2 2 0 1 1 0 3.6V19h-3.2a2 2 0 1 0-3.6 0H5v-4.2a2 2 0 1 0 0-3.6Z" />
    </Svg>
  );
}

/** Decisions: one path splitting into two. */
export function DecisionIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="19" r="2" />
      <path d="M6 17V12a4 4 0 0 1 4-4h8" />
      <path d="M6 12a4 4 0 0 0 4 4h8" />
      <path d="m15 5 3 3-3 3" />
      <path d="m15 13 3 3-3 3" />
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
