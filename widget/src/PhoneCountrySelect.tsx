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
};

export function PhoneCountrySelect({
  value,
  onChange,
  className,
  id,
}: PhoneCountrySelectProps) {
  const { popular, all, popularSet } = listPhoneCountriesGrouped();

  return (
    <select
      id={id}
      className={cn(phoneCountrySelectClass, "cursor-pointer pr-6", className)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Country code"
    >
      <optgroup label="Popular">
        {popular.map((country) => (
          <option key={`popular-${country.iso}`} value={country.iso}>
            {formatPhoneCountryLabel(country)}
          </option>
        ))}
      </optgroup>
      <optgroup label="All countries">
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
