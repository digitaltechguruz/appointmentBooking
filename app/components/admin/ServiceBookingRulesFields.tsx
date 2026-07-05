import {
  BookingRulesField,
  NumberStepper,
  OptionalNumberStepper,
  ValueUnitInput,
} from "./BookingRulesFields";
import type {
  OptionalNumeric,
  ServiceBookingRulesFormState,
} from "../../lib/booking/booking-rules-form.shared";
import { isServiceBookingRulesComplete } from "../../lib/booking/booking-rules-form.shared";
import type { DurationUnit, NoticeUnit, RangeUnit } from "../../lib/booking/booking-rules.shared";
import { useAdminI18n } from "../../lib/admin-i18n";
import { useMemo } from "react";

type Props = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  form: ServiceBookingRulesFormState;
  onChange: (form: ServiceBookingRulesFormState) => void;
  embedded?: boolean;
};

function parseNumericInput(raw: string): OptionalNumeric {
  if (raw.trim() === "") return "";
  const num = Number(raw);
  return Number.isFinite(num) ? num : "";
}

export function ServiceBookingRulesFields({
  enabled,
  onEnabledChange,
  form,
  onChange,
  embedded = false,
}: Props) {
  const { t } = useAdminI18n();
  const incomplete = enabled && !isServiceBookingRulesComplete(form);

  const durationUnits = useMemo(
    () => [
      { value: "minutes", label: t("bookingRules.unitMinutes") },
      { value: "hours", label: t("bookingRules.unitHours") },
    ],
    [t],
  );

  const noticeUnits = useMemo(
    () => [
      { value: "minutes", label: t("bookingRules.unitMinutes") },
      { value: "hours", label: t("bookingRules.unitHours") },
      { value: "days", label: t("bookingRules.unitDays") },
      { value: "weeks", label: t("bookingRules.unitWeeks") },
    ],
    [t],
  );

  const rangeUnits = useMemo(
    () => [
      { value: "days", label: t("bookingRules.unitDays") },
      { value: "weeks", label: t("bookingRules.unitWeeks") },
      { value: "months", label: t("bookingRules.unitMonths") },
    ],
    [t],
  );

  function updateField<K extends keyof ServiceBookingRulesFormState>(
    key: K,
    value: ServiceBookingRulesFormState[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div
      className={
        embedded ? "ab-services-accordion__content ab-services__booking-rules--embedded" : "ab-services__booking-rules"
      }
    >
      <div className="ab-services__booking-rules-head">
        <label className="ab-booking-rules__toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span className="ab-booking-rules__toggle-track" />
        </label>
        <div>
          <span className="ab-services__form-label">{t("services.customBookingRules")}</span>
          <p className="ab-services__hint">{t("services.customBookingRulesHint")}</p>
        </div>
      </div>

      {enabled ? (
        <>
          {incomplete ? (
            <p className="ab-services__hint ab-services__hint--warning">
              {t("services.bookingRulesIncompleteHint")}
            </p>
          ) : null}
          <div className="ab-services__booking-rules-grid">
            <BookingRulesField
              label={t("bookingRules.meetingDuration")}
              tooltip={t("bookingRules.meetingDurationTip")}
            >
              <ValueUnitInput
                value={form.defaultDurationValue}
                unit={form.defaultDurationUnit}
                units={durationUnits}
                min={1}
                max={480}
                placeholder={t("bookingRules.placeholderRequired")}
                onValueChange={(value) =>
                  updateField("defaultDurationValue", parseNumericInput(value))
                }
                onUnitChange={(unit) =>
                  updateField("defaultDurationUnit", unit as DurationUnit)
                }
              />
            </BookingRulesField>

            <BookingRulesField
              label={t("bookingRules.meetingInterval")}
              tooltip={t("bookingRules.meetingIntervalTip")}
            >
              <ValueUnitInput
                value={form.slotIntervalValue}
                unit={form.slotIntervalUnit}
                units={durationUnits}
                min={1}
                max={480}
                placeholder={t("bookingRules.placeholderOptional")}
                onValueChange={(value) =>
                  updateField("slotIntervalValue", parseNumericInput(value))
                }
                onUnitChange={(unit) =>
                  updateField("slotIntervalUnit", unit as DurationUnit)
                }
              />
            </BookingRulesField>

            <BookingRulesField
              label={t("bookingRules.minNotice")}
              tooltip={t("bookingRules.minNoticeTip")}
            >
              <ValueUnitInput
                value={form.minNoticeValue}
                unit={form.minNoticeUnit}
                units={noticeUnits}
                min={0}
                placeholder={t("bookingRules.placeholderOptional")}
                onValueChange={(value) =>
                  updateField("minNoticeValue", parseNumericInput(value))
                }
                onUnitChange={(unit) =>
                  updateField("minNoticeUnit", unit as NoticeUnit)
                }
              />
            </BookingRulesField>

            <BookingRulesField
              label={t("bookingRules.dateRange")}
              tooltip={t("bookingRules.dateRangeEmptyTip")}
            >
              <ValueUnitInput
                value={form.maxAdvanceValue}
                unit={form.maxAdvanceUnit}
                units={rangeUnits}
                min={1}
                placeholder={t("bookingRules.placeholderDateRange")}
                onValueChange={(value) =>
                  updateField("maxAdvanceValue", parseNumericInput(value))
                }
                onUnitChange={(unit) =>
                  updateField("maxAdvanceUnit", unit as RangeUnit)
                }
              />
            </BookingRulesField>

            <BookingRulesField
              label={t("bookingRules.preBuffer")}
              tooltip={t("bookingRules.preBufferTip")}
            >
              <ValueUnitInput
                value={form.bufferBeforeValue}
                unit={form.bufferBeforeUnit}
                units={durationUnits}
                min={0}
                placeholder={t("bookingRules.placeholderOptional")}
                onValueChange={(value) =>
                  updateField("bufferBeforeValue", parseNumericInput(value))
                }
                onUnitChange={(unit) =>
                  updateField("bufferBeforeUnit", unit as DurationUnit)
                }
              />
            </BookingRulesField>

            <BookingRulesField
              label={t("bookingRules.postBuffer")}
              tooltip={t("bookingRules.postBufferTip")}
            >
              <ValueUnitInput
                value={form.bufferAfterValue}
                unit={form.bufferAfterUnit}
                units={durationUnits}
                min={0}
                placeholder={t("bookingRules.placeholderOptional")}
                onValueChange={(value) =>
                  updateField("bufferAfterValue", parseNumericInput(value))
                }
                onUnitChange={(unit) =>
                  updateField("bufferAfterUnit", unit as DurationUnit)
                }
              />
            </BookingRulesField>

            <BookingRulesField
              label={t("bookingRules.maxPerDay")}
              tooltip={t("bookingRules.maxPerDayTip")}
            >
              <OptionalNumberStepper
                value={form.maxBookingsPerDay}
                min={0}
                max={999}
                placeholder={t("bookingRules.placeholderNoLimit")}
                onChange={(value) => updateField("maxBookingsPerDay", value)}
              />
            </BookingRulesField>

            <BookingRulesField
              label={t("bookingRules.maxPerSlot")}
              tooltip={t("bookingRules.maxPerSlotTip")}
            >
              <OptionalNumberStepper
                value={form.maxBookingsPerSlot}
                min={1}
                max={99}
                placeholder={t("bookingRules.placeholderOptional")}
                onChange={(value) => updateField("maxBookingsPerSlot", value)}
              />
            </BookingRulesField>

            <div className="ab-booking-rules__field ab-booking-rules__field--full">
              <div className="ab-booking-rules__look-busy">
                <div className="ab-booking-rules__toggle-row">
                  <label className="ab-booking-rules__toggle">
                    <input
                      type="checkbox"
                      checked={form.lookBusyEnabled}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        onChange({
                          ...form,
                          lookBusyEnabled: checked,
                          lookBusyPercent: checked ? form.lookBusyPercent : "",
                        });
                      }}
                    />
                    <span className="ab-booking-rules__toggle-track" />
                  </label>
                  <div className="ab-booking-rules__label-row">
                    <span className="ab-booking-rules__label">{t("bookingRules.lookBusy")}</span>
                  </div>
                </div>
                <div className="ab-booking-rules__percent">
                  <input
                    type="number"
                    className="ab-booking-rules__number"
                    value={form.lookBusyPercent}
                    min={0}
                    max={100}
                    placeholder={t("bookingRules.placeholderOptional")}
                    disabled={!form.lookBusyEnabled}
                    onChange={(event) =>
                      updateField("lookBusyPercent", parseNumericInput(event.target.value))
                    }
                  />
                  <span className="ab-booking-rules__percent-suffix">%</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function hiddenValue(value: OptionalNumeric) {
  return value === "" ? "" : String(value);
}

export function serviceBookingRulesHiddenInputs({
  enabled,
  form,
}: {
  enabled: boolean;
  form: ServiceBookingRulesFormState;
}) {
  if (!enabled) {
    return <input type="hidden" name="useCustomBookingRules" value="false" />;
  }

  return (
    <>
      <input type="hidden" name="useCustomBookingRules" value="true" />
      <input type="hidden" name="defaultDurationValue" value={hiddenValue(form.defaultDurationValue)} />
      <input type="hidden" name="defaultDurationUnit" value={form.defaultDurationUnit} />
      <input type="hidden" name="slotIntervalValue" value={hiddenValue(form.slotIntervalValue)} />
      <input type="hidden" name="slotIntervalUnit" value={form.slotIntervalUnit} />
      <input type="hidden" name="minNoticeValue" value={hiddenValue(form.minNoticeValue)} />
      <input type="hidden" name="minNoticeUnit" value={form.minNoticeUnit} />
      <input type="hidden" name="maxAdvanceValue" value={hiddenValue(form.maxAdvanceValue)} />
      <input type="hidden" name="maxAdvanceUnit" value={form.maxAdvanceUnit} />
      <input type="hidden" name="bufferBeforeValue" value={hiddenValue(form.bufferBeforeValue)} />
      <input type="hidden" name="bufferBeforeUnit" value={form.bufferBeforeUnit} />
      <input type="hidden" name="bufferAfterValue" value={hiddenValue(form.bufferAfterValue)} />
      <input type="hidden" name="bufferAfterUnit" value={form.bufferAfterUnit} />
      <input type="hidden" name="maxBookingsPerDay" value={hiddenValue(form.maxBookingsPerDay)} />
      <input type="hidden" name="maxBookingsPerSlot" value={hiddenValue(form.maxBookingsPerSlot)} />
      <input type="hidden" name="lookBusyEnabled" value={String(form.lookBusyEnabled)} />
      <input type="hidden" name="lookBusyPercent" value={hiddenValue(form.lookBusyPercent)} />
    </>
  );
}
