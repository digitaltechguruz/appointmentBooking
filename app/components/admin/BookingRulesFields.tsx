import type { ReactNode } from "react";

type Props = {
  label: string;
  tooltip: ReactNode;
  children: ReactNode;
  className?: string;
};

export function BookingRulesField({ label, tooltip, children, className }: Props) {
  return (
    <div className={`ab-booking-rules__field${className ? ` ${className}` : ""}`}>
      <div className="ab-booking-rules__label-row">
        <label className="ab-booking-rules__label">{label}</label>
        <span className="ab-booking-rules__tip" tabIndex={0}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 10v6M12 7h.01"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span className="ab-booking-rules__tip-content" role="tooltip">
            {tooltip}
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}

type ValueUnitProps = {
  value: number | string;
  unit: string;
  units: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  onUnitChange: (unit: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
};

export function ValueUnitInput({
  value,
  unit,
  units,
  onValueChange,
  onUnitChange,
  min = 0,
  max,
  placeholder,
}: ValueUnitProps) {
  return (
    <div className="ab-booking-rules__value-unit">
      <input
        type="number"
        className="ab-booking-rules__number"
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <select
        className="ab-booking-rules__unit"
        value={unit}
        onChange={(event) => onUnitChange(event.target.value)}
      >
        {units.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function NumberStepper({ value, onChange, min = 0, max = 999 }: StepperProps) {
  return (
    <div className="ab-booking-rules__stepper">
      <button
        type="button"
        className="ab-booking-rules__stepper-btn"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <input
        type="number"
        className="ab-booking-rules__stepper-input"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(Math.min(max, Math.max(min, next)));
          }
        }}
      />
      <button
        type="button"
        className="ab-booking-rules__stepper-btn"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

type OptionalStepperProps = {
  value: number | "";
  onChange: (value: number | "") => void;
  min?: number;
  max?: number;
  placeholder?: string;
};

export function OptionalNumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  placeholder,
}: OptionalStepperProps) {
  const numericValue = value === "" ? min : value;

  return (
    <div className="ab-booking-rules__stepper">
      <button
        type="button"
        className="ab-booking-rules__stepper-btn"
        aria-label="Decrease"
        disabled={value !== "" && value <= min}
        onClick={() => {
          if (value === "") {
            onChange(min);
            return;
          }
          onChange(Math.max(min, value - 1));
        }}
      >
        −
      </button>
      <input
        type="number"
        className="ab-booking-rules__stepper-input"
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw.trim() === "") {
            onChange("");
            return;
          }
          const next = Number(raw);
          if (Number.isFinite(next)) {
            onChange(Math.min(max, Math.max(min, next)));
          }
        }}
      />
      <button
        type="button"
        className="ab-booking-rules__stepper-btn"
        aria-label="Increase"
        disabled={value !== "" && value >= max}
        onClick={() => {
          if (value === "") {
            onChange(Math.max(min, numericValue + 1));
            return;
          }
          onChange(Math.min(max, value + 1));
        }}
      >
        +
      </button>
    </div>
  );
}
