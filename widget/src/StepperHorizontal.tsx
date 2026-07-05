import { cn } from "./cn";
import type { WidgetThemeStyles } from "./theme-styles";

type Props = {
  current: number;
  total: number;
  theme: WidgetThemeStyles;
  ariaLabel?: string;
};

export function StepperHorizontal({ current, total, theme, ariaLabel }: Props) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div
      className={cn(theme.stepperWrap, "mx-auto mb-10 w-full max-w-[540px] px-1")}
      role="navigation"
      aria-label={ariaLabel ?? "Booking progress"}
    >
      <div className="flex items-center">
        {steps.map((n, idx) => {
          const state =
            n < current ? "done" : n === current ? "active" : "upcoming";
          return (
            <div key={n} className="flex min-w-0 flex-1 items-center last:flex-grow-0">
              <div
                className={theme.stepCircle(state)}
                aria-current={n === current ? "step" : undefined}
              >
                {n < current ? "✓" : n}
              </div>
              {idx < steps.length - 1 && (
                <div className={theme.stepConnector} aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
