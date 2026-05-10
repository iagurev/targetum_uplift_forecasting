import Link from "next/link";

export function Logo({
  className,
  href = "/",
  withLabel = true
}: {
  className?: string;
  href?: string;
  withLabel?: boolean;
}) {
  return (
    <span className={className ?? ""}>
      <Link className="pilot-logo-link" href={href}>
        <svg className="size-8" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="24" height="24" rx="8" fill="var(--pilot-primary)" />
          <path
            d="M10.5 23L16 9L21.5 23"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12.75 18H19.25"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="9" r="1.6" fill="white" />
        </svg>
        {withLabel ? <span className="pilot-logo-text">Agentary</span> : null}
      </Link>
    </span>
  );
}
