import {
  formatPhoneCountryLabel,
  listPhoneCountriesGrouped,
} from "./phone-countries";
import { cn } from "./cn";
import { phoneCountrySelectClass } from "./styles";

type PhoneCountrySelectProps = {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  id?: string;
  ariaLabel?: string;
  popularLabel?: string;
  allCountriesLabel?: string;
};

export function PhoneCountrySelect({
  value,
  onChange,
  className,
  id,
  ariaLabel,
  popularLabel = "Popular",
  allCountriesLabel = "All countries",
}: PhoneCountrySelectProps) {
  const { popular, all, popularSet } = listPhoneCountriesGrouped();

  return (
    <select
      id={id}
      className={cn(phoneCountrySelectClass, "cursor-pointer pr-6", className)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel ?? "Country code"}
    >
      <optgroup label={popularLabel}>
        {popular.map((country) => (
          <option key={`popular-${country.iso}`} value={country.iso}>
            {formatPhoneCountryLabel(country)}
          </option>
        ))}
      </optgroup>
      <optgroup label={allCountriesLabel}>
        {all.map((country) =>
          popularSet.has(country.iso) ? null : (
            <option key={country.iso} value={country.iso}>
              {formatPhoneCountryLabel(country)}
            </option>
          ),
        )}
      </optgroup>
    </select>
  );
}
