import {
  fromAdvanceDays,
  fromMinutes,
  fromNoticeMinutes,
  toDays,
  toMinutes,
  type BookingRules,
  type DurationUnit,
  type NoticeUnit,
  type RangeUnit,
} from "./booking-rules.shared";
import type { ServiceBookingRulesInput } from "./booking-rules.server";

export type OptionalNumeric = number | "";

export type BookingRulesFormState = {
  slotIntervalValue: OptionalNumeric;
  slotIntervalUnit: DurationUnit;
  defaultDurationValue: OptionalNumeric;
  defaultDurationUnit: DurationUnit;
  minNoticeValue: OptionalNumeric;
  minNoticeUnit: NoticeUnit;
  maxAdvanceValue: OptionalNumeric;
  maxAdvanceUnit: RangeUnit;
  bufferBeforeValue: OptionalNumeric;
  bufferBeforeUnit: DurationUnit;
  bufferAfterValue: OptionalNumeric;
  bufferAfterUnit: DurationUnit;
  maxBookingsPerDay: OptionalNumeric;
  maxBookingsPerSlot: OptionalNumeric;
  lookBusyEnabled: boolean;
  lookBusyPercent: OptionalNumeric;
};

export type ServiceBookingRulesFormState = BookingRulesFormState;

export function emptyServiceBookingRulesFormState(): ServiceBookingRulesFormState {
  return {
    slotIntervalValue: "",
    slotIntervalUnit: "minutes",
    defaultDurationValue: "",
    defaultDurationUnit: "minutes",
    minNoticeValue: "",
    minNoticeUnit: "minutes",
    maxAdvanceValue: "",
    maxAdvanceUnit: "months",
    bufferBeforeValue: "",
    bufferBeforeUnit: "minutes",
    bufferAfterValue: "",
    bufferAfterUnit: "minutes",
    maxBookingsPerDay: "",
    maxBookingsPerSlot: "",
    lookBusyEnabled: false,
    lookBusyPercent: "",
  };
}

export function rulesToFormState(rules: BookingRules): BookingRulesFormState {
  const slotInterval = fromMinutes(rules.slotIntervalMinutes, ["hours", "minutes"]);
  const defaultDuration = fromMinutes(rules.defaultDurationMinutes, ["hours", "minutes"]);
  const minNotice = fromNoticeMinutes(rules.minNoticeMinutes);
  const maxAdvance = fromAdvanceDays(rules.maxAdvanceDays);
  const bufferBefore = fromMinutes(rules.bufferBeforeMinutes, ["hours", "minutes"]);
  const bufferAfter = fromMinutes(rules.bufferAfterMinutes, ["hours", "minutes"]);

  return {
    slotIntervalValue: slotInterval.value,
    slotIntervalUnit: slotInterval.unit,
    defaultDurationValue: defaultDuration.value,
    defaultDurationUnit: defaultDuration.unit,
    minNoticeValue: minNotice.value,
    minNoticeUnit: minNotice.unit,
    maxAdvanceValue: maxAdvance.value,
    maxAdvanceUnit: maxAdvance.unit,
    bufferBeforeValue: bufferBefore.value,
    bufferBeforeUnit: bufferBefore.unit,
    bufferAfterValue: bufferAfter.value,
    bufferAfterUnit: bufferAfter.unit,
    maxBookingsPerDay: rules.maxBookingsPerDay,
    maxBookingsPerSlot: rules.maxBookingsPerSlot,
    lookBusyEnabled: rules.lookBusyEnabled,
    lookBusyPercent: rules.lookBusyPercent,
  };
}

function parseOptionalNumber(value: OptionalNumeric): number | null {
  if (value === "" || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function isServiceBookingRulesComplete(
  form: ServiceBookingRulesFormState,
): boolean {
  const duration = parseOptionalNumber(form.defaultDurationValue);
  return duration != null && duration >= 1;
}

export function formStateToRules(state: BookingRulesFormState): BookingRules {
  return {
    slotIntervalMinutes: toMinutes(
      parseOptionalNumber(state.slotIntervalValue) ?? 0,
      state.slotIntervalUnit,
    ),
    defaultDurationMinutes: toMinutes(
      parseOptionalNumber(state.defaultDurationValue) ?? 0,
      state.defaultDurationUnit,
    ),
    minNoticeMinutes: toMinutes(
      parseOptionalNumber(state.minNoticeValue) ?? 0,
      state.minNoticeUnit,
    ),
    maxAdvanceDays: toDays(
      parseOptionalNumber(state.maxAdvanceValue) ?? 0,
      state.maxAdvanceUnit,
    ),
    bufferBeforeMinutes: toMinutes(
      parseOptionalNumber(state.bufferBeforeValue) ?? 0,
      state.bufferBeforeUnit,
    ),
    bufferAfterMinutes: toMinutes(
      parseOptionalNumber(state.bufferAfterValue) ?? 0,
      state.bufferAfterUnit,
    ),
    maxBookingsPerDay: parseOptionalNumber(state.maxBookingsPerDay) ?? 0,
    maxBookingsPerSlot: parseOptionalNumber(state.maxBookingsPerSlot) ?? 1,
    lookBusyEnabled: state.lookBusyEnabled,
    lookBusyPercent: parseOptionalNumber(state.lookBusyPercent) ?? 0,
  };
}

export function formStateToServiceBookingInput(
  form: ServiceBookingRulesFormState,
): {
  durationMinutes: number;
  bookingRules: ServiceBookingRulesInput;
} {
  const durationMinutes = toMinutes(
    parseOptionalNumber(form.defaultDurationValue)!,
    form.defaultDurationUnit,
  );

  const slotInterval =
    parseOptionalNumber(form.slotIntervalValue) != null
      ? toMinutes(parseOptionalNumber(form.slotIntervalValue)!, form.slotIntervalUnit)
      : null;

  const minNotice =
    parseOptionalNumber(form.minNoticeValue) != null
      ? toMinutes(parseOptionalNumber(form.minNoticeValue)!, form.minNoticeUnit)
      : null;

  const maxAdvance =
    parseOptionalNumber(form.maxAdvanceValue) != null
      ? toDays(parseOptionalNumber(form.maxAdvanceValue)!, form.maxAdvanceUnit)
      : null;

  const bufferBefore =
    parseOptionalNumber(form.bufferBeforeValue) != null
      ? toMinutes(parseOptionalNumber(form.bufferBeforeValue)!, form.bufferBeforeUnit)
      : null;

  const bufferAfter =
    parseOptionalNumber(form.bufferAfterValue) != null
      ? toMinutes(parseOptionalNumber(form.bufferAfterValue)!, form.bufferAfterUnit)
      : null;

  const maxPerDay = parseOptionalNumber(form.maxBookingsPerDay);
  const maxPerSlot = parseOptionalNumber(form.maxBookingsPerSlot);

  const lookBusyEnabled = form.lookBusyEnabled ? true : null;
  const lookBusyPercent =
    form.lookBusyEnabled && parseOptionalNumber(form.lookBusyPercent) != null
      ? parseOptionalNumber(form.lookBusyPercent)!
      : null;

  return {
    durationMinutes,
    bookingRules: {
      useCustomBookingRules: true,
      slotIntervalMinutes: slotInterval,
      minNoticeMinutes: minNotice,
      maxAdvanceDays: maxAdvance,
      bufferBeforeMinutes: bufferBefore,
      bufferAfterMinutes: bufferAfter,
      maxBookingsPerDay: maxPerDay,
      maxBookingsPerSlot: maxPerSlot,
      lookBusyEnabled,
      lookBusyPercent,
    },
  };
}

export function serviceFormStateToRules(state: ServiceBookingRulesFormState): BookingRules {
  return formStateToRules(state);
}

export function rulesToServiceFormState(rules: BookingRules): ServiceBookingRulesFormState {
  return rulesToFormState(rules);
}

type ServiceBookingRulesRecord = {
  useCustomBookingRules: boolean;
  durationMinutes: number;
  slotIntervalMinutes: number | null;
  minNoticeMinutes: number | null;
  maxAdvanceDays: number | null;
  bufferBeforeMinutes: number | null;
  bufferAfterMinutes: number | null;
  maxBookingsPerDay: number | null;
  maxBookingsPerSlot: number | null;
  lookBusyEnabled: boolean | null;
  lookBusyPercent: number | null;
};

function nullableDurationField(
  minutes: number | null,
): { value: OptionalNumeric; unit: DurationUnit } {
  if (minutes == null) return { value: "", unit: "minutes" };
  const parsed = fromMinutes(minutes, ["hours", "minutes"]);
  return { value: parsed.value, unit: parsed.unit };
}

function nullableNoticeField(
  minutes: number | null,
): { value: OptionalNumeric; unit: NoticeUnit } {
  if (minutes == null) return { value: "", unit: "minutes" };
  const parsed = fromNoticeMinutes(minutes);
  return { value: parsed.value, unit: parsed.unit };
}

function nullableAdvanceField(
  days: number | null,
): { value: OptionalNumeric; unit: RangeUnit } {
  if (days == null) return { value: "", unit: "months" };
  const parsed = fromAdvanceDays(days);
  return { value: parsed.value, unit: parsed.unit };
}

export function serviceRecordToBookingRulesForm(
  service: ServiceBookingRulesRecord | null,
): { enabled: boolean; form: ServiceBookingRulesFormState } {
  if (!service?.useCustomBookingRules) {
    return {
      enabled: false,
      form: emptyServiceBookingRulesFormState(),
    };
  }

  const duration = fromMinutes(service.durationMinutes, ["hours", "minutes"]);
  const slotInterval = nullableDurationField(service.slotIntervalMinutes);
  const minNotice = nullableNoticeField(service.minNoticeMinutes);
  const maxAdvance = nullableAdvanceField(service.maxAdvanceDays);
  const bufferBefore = nullableDurationField(service.bufferBeforeMinutes);
  const bufferAfter = nullableDurationField(service.bufferAfterMinutes);

  return {
    enabled: true,
    form: {
      slotIntervalValue: slotInterval.value,
      slotIntervalUnit: slotInterval.unit,
      defaultDurationValue: duration.value,
      defaultDurationUnit: duration.unit,
      minNoticeValue: minNotice.value,
      minNoticeUnit: minNotice.unit,
      maxAdvanceValue: maxAdvance.value,
      maxAdvanceUnit: maxAdvance.unit,
      bufferBeforeValue: bufferBefore.value,
      bufferBeforeUnit: bufferBefore.unit,
      bufferAfterValue: bufferAfter.value,
      bufferAfterUnit: bufferAfter.unit,
      maxBookingsPerDay:
        service.maxBookingsPerDay != null ? service.maxBookingsPerDay : "",
      maxBookingsPerSlot:
        service.maxBookingsPerSlot != null ? service.maxBookingsPerSlot : "",
      lookBusyEnabled: service.lookBusyEnabled === true,
      lookBusyPercent:
        service.lookBusyEnabled === true && service.lookBusyPercent != null
          ? service.lookBusyPercent
          : "",
    },
  };
}
