// Line icons drawn on a 24px grid; they inherit size and colour from CSS.
type Props = { className?: string };
const svg = (path: React.ReactNode) =>
  function Icon({ className }: Props) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {path}
      </svg>
    );
  };
export const MemoryIcon = svg(
  <>
    <rect x="3" y="5" width="11" height="15" rx="2" />
    <path d="M10 5.5 11.5 4h7.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" />
    <path d="M8.5 10.5v4M6.5 12.5h4" />
  </>,
);
export const LogicIcon = svg(
  <>
    <circle cx="5" cy="6" r="2.2" />
    <circle cx="19" cy="6" r="2.2" />
    <circle cx="12" cy="18" r="2.2" />
    <path d="M7.2 6h9.6M6.1 8l4.8 8M17.9 8l-4.8 8" />
  </>,
);
export const DecisionIcon = svg(
  <>
    <circle cx="6" cy="19" r="2" />
    <path d="M6 17V12a4 4 0 0 1 4-4h8M15 5l3 3-3 3" />
    <path d="M6 12a4 4 0 0 0 4 4h8M15 13l3 3-3 3" />
  </>,
);
export const MailIcon = svg(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </>,
);
export const StarIcon = svg(
  <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
);
