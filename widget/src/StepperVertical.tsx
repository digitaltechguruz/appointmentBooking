import { cn } from "./cn";
import { BOOKING_STEP_META, type BookingStepMeta } from "./stepper-steps";
import type { WidgetThemeStyles } from "./theme-styles";

type Props = {
  current: number;
  total: number;
  theme: WidgetThemeStyles;
  stepsMeta?: BookingStepMeta[];
};

function StepIcon({ icon, className }: { icon: string; className?: string }) {
  const props = {
    className: cn("h-4 w-4", className),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    "aria-hidden": true as const,
  };

  switch (icon) {
    case "services":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "meeting":
      return (
        <svg {...props}>
          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
  }
}

export function StepperVertical({ current, total, theme, stepsMeta }: Props) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  const metaList = stepsMeta ?? BOOKING_STEP_META;

  return (
    <nav
      className={cn(theme.stepperSidebar, theme.stepperWrap)}
      role="navigation"
      aria-label="Booking progress"
    >
      <ol className="m-0 list-none p-0">
        {steps.map((stepNumber, idx) => {
          const meta = metaList[idx] ?? BOOKING_STEP_META[idx];
          const state =
            stepNumber < current
              ? "done"
              : stepNumber === current
                ? "active"
                : "upcoming";

          return (
            <li
              key={stepNumber}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] gap-3",
                idx < steps.length - 1 && "pb-1",
              )}
              aria-current={stepNumber === current ? "step" : undefined}
            >
              <div className="min-w-0 pt-1 text-left">
                <div className={theme.stepLabelTitle(state)}>{meta.title}</div>
                <div className={theme.stepLabelSubtitle(state)}>{meta.subtitle}</div>
              </div>

              <div className="flex flex-col items-center">
                <div className={theme.stepCircle(state)}>
                  {state === "done" ? (
                    <span className="text-sm font-bold">✓</span>
                  ) : (
                    <StepIcon icon={meta.icon} />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className={theme.stepConnectorVertical} aria-hidden />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
