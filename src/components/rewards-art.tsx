// The dingn coin and badge medals, drawn as SVG so they stay sharp at every
// size. Every game's badges use these frames: a game picks a tier and either
// a level number or one of the icons below.
import { useId } from "react";
import type { BadgeIcon, Tier } from "@/lib/rewards";

const LOGO_BODY =
  "M18 12h31c25 0 39 15 39 37 0 19-12 34-30 37L47 73 35 86 24 73 12 82V24a12 12 0 0 1 6-12Z";
const LOGO_STAR = "m67 8 4-7 4 7 8 3-8 3-4 7-4-7-8-3 8-3Z";

function Logo({
  color,
  eyes,
  dy = 0,
}: {
  color: string;
  eyes: string;
  dy?: number;
}) {
  return (
    <g transform={`translate(20 ${23 + dy}) scale(0.6)`}>
      <path d={LOGO_BODY} fill={color} />
      <rect x="29" y="33" width="12" height="23" rx="6" fill={eyes} />
      <rect x="54" y="29" width="12" height="23" rx="6" fill={eyes} />
      <path d={LOGO_STAR} fill={color} />
    </g>
  );
}

/** The dingn coin: gold, with the dingn logo stamped in the middle. */
export function Coin({ size = 20, label }: { size?: number; label?: string }) {
  const id = useId().replace(/:/g, "");
  const detailed = size >= 48;
  return (
    <svg
      className="coin"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    >
      <defs>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde69a" />
          <stop offset="0.5" stopColor="#e6ad3e" />
          <stop offset="1" stopColor="#b07818" />
        </linearGradient>
        <radialGradient id={`${id}f`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fff2bd" />
          <stop offset="0.6" stopColor="#f3c85c" />
          <stop offset="1" stopColor="#d99a2b" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="52" r="47" fill="#9a6512" />
      <circle cx="50" cy="48" r="47" fill={`url(#${id}e)`} />
      {detailed && (
        <circle
          cx="50"
          cy="48"
          r="42"
          fill="none"
          stroke="#b07818"
          strokeWidth="2.4"
          strokeDasharray="1.6 2.4"
        />
      )}
      <circle
        cx="50"
        cy="48"
        r="36"
        fill={`url(#${id}f)`}
        stroke="#c48a24"
        strokeWidth={detailed ? 2 : 3}
      />
      {detailed && <Logo color="#fff4cc" eyes="#fff4cc" dy={1.5} />}
      <Logo color="#9a6512" eyes="#f3c85c" />
      {detailed && (
        <path
          d="M21 36 A32 32 0 0 1 52 13"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.7"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

const TIERS: Record<
  Tier,
  {
    outer: [string, string, string?];
    inner: [string, string];
    ink: string;
    sub: string;
  }
> = {
  bronze: {
    outer: ["#f4c49a", "#a5612f"],
    inner: ["#8f4f28", "#5a2e14"],
    ink: "#ffd9b8",
    sub: "#f0c49f",
  },
  silver: {
    outer: ["#ffffff", "#97a2ad"],
    inner: ["#63707d", "#363f49"],
    ink: "#ffffff",
    sub: "#dfe5ea",
  },
  gold: {
    outer: ["#ffe88a", "#c88912"],
    inner: ["#a46c0e", "#5f3d08"],
    ink: "#fff1bf",
    sub: "#f5d27a",
  },
  diamond: {
    outer: ["#d4f6ff", "#76aef2", "#7a63ea"],
    inner: ["#30559f", "#1b2759"],
    ink: "#e6f7ff",
    sub: "#a9d8ff",
  },
};
const LOCKED = {
  outer: ["#e9ece3", "#c3c8bb"],
  inner: ["#b9bfb4", "#9ca396"],
  ink: "#ffffff",
  sub: "#ffffff",
};

const STAR =
  "12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";

/** Line icons on a 24-unit grid, drawn inside the medal. */
function Icon({ icon, color }: { icon: BadgeIcon; color: string }) {
  if (icon === "stars")
    return (
      <g
        fill="#ffe08a"
        stroke="#c88912"
        strokeWidth="0.6"
        strokeLinejoin="round"
      >
        <polygon transform="translate(29 54) scale(1.05)" points={STAR} />
        <polygon transform="translate(44.5 30) scale(1.3)" points={STAR} />
        <polygon transform="translate(66 54) scale(1.05)" points={STAR} />
      </g>
    );
  const paths: Record<Exclude<BadgeIcon, "stars">, React.ReactNode> = {
    boss: (
      <>
        <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
        <path d="M13 19l6-6M16 16l4 4M19 21l2-2" />
        <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
        <path d="M5 14l4 4M7 17l-3 3M3 19l2 2" />
      </>
    ),
    star: <polygon points={STAR} />,
    squad: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    trophy: (
      <>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </>
    ),
    crown: <path d="M2 6l4 11h12l4-11-6 5-4-7-4 7-6-5zM5 21h14" />,
    bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    heart: (
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
  };
  return (
    <g
      transform="translate(36 34) scale(2)"
      fill="none"
      stroke={color}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon]}
    </g>
  );
}

/**
 * A badge: a hexagon medal on a green ribbon, in its tier's metal, with a
 * level number or an icon. A badge not earned yet is grey with a lock.
 */
export function BadgeMedal({
  tier,
  level,
  icon,
  locked = false,
  size = 64,
  label,
  levelText = "LEVEL",
}: {
  levelText?: string;
  tier: Tier;
  level?: number;
  icon?: BadgeIcon;
  locked?: boolean;
  size?: number;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const look = locked ? LOCKED : (TIERS[tier] ?? TIERS.bronze);
  const [o1, o2, o3] = look.outer;
  const digits = String(level ?? "").length;
  return (
    <svg
      className="badge-medal"
      viewBox="0 0 120 132"
      width={size}
      height={(size * 132) / 120}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    >
      <defs>
        <linearGradient id={`${id}o`} x1="0" y1="0" x2="0.45" y2="1">
          <stop offset="0" stopColor={o1} />
          {o3 && <stop offset="0.55" stopColor={o2} />}
          <stop offset="1" stopColor={o3 ?? o2} />
        </linearGradient>
        <linearGradient id={`${id}i`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.inner[0]} />
          <stop offset="1" stopColor={look.inner[1]} />
        </linearGradient>
      </defs>
      <path
        d="M36 96 L24 128 L39 121 L47 132 L55 104 Z"
        fill={locked ? "#c3c8bb" : "#426b54"}
      />
      <path
        d="M84 96 L96 128 L81 121 L73 132 L65 104 Z"
        fill={locked ? "#b1b7a9" : "#355a45"}
      />
      <polygon
        points="60,4 108,32 108,88 60,116 12,88 12,32"
        fill={`url(#${id}o)`}
      />
      <polygon
        points="60,15 98.5,37.5 98.5,82.5 60,105 21.5,82.5 21.5,37.5"
        fill={`url(#${id}i)`}
        stroke="#fff"
        strokeOpacity={locked ? 0 : 0.3}
        strokeWidth="1.5"
      />
      {!locked && (
        <polygon points="60,4 108,32 60,44 12,32" fill="#fff" opacity="0.18" />
      )}
      {!locked && tier === "diamond" && (
        <path
          d="M98 14 L100.5 19.5 L106 22 L100.5 24.5 L98 30 L95.5 24.5 L90 22 L95.5 19.5 Z"
          fill="#fff"
        />
      )}
      {locked ? (
        <g
          transform="translate(40 38) scale(1.67)"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </g>
      ) : level != null ? (
        <>
          <text
            x="60"
            y="68"
            textAnchor="middle"
            fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif"
            fontWeight="700"
            fontSize={digits >= 4 ? 26 : digits === 3 ? 32 : 40}
            fill={look.ink}
          >
            {level}
          </text>
          <text
            x="60"
            y="87"
            textAnchor="middle"
            fontWeight="700"
            fontSize="11"
            letterSpacing="2"
            fill={look.sub}
          >
            {levelText}
          </text>
        </>
      ) : (
        icon && <Icon icon={icon} color={look.ink} />
      )}
    </svg>
  );
}
