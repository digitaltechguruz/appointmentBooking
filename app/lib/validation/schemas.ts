import { z } from "zod";
import { parseTimeToMinutes } from "../booking/time";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

function isEndAfterStart(startTime: string, endTime: string) {
  return parseTimeToMinutes(endTime) > parseTimeToMinutes(startTime);
}
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function isDateOnOrAfterToday(dateStr: string) {
  return dateStr >= todayDateString();
}

export const shopQuerySchema = z.object({
  shop: z.string().min(1),
});

export const serviceCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.union([z.string().url(), z.literal("")]).optional(),
  active: z.boolean().default(true),
  meetingTypeIds: z.array(z.string()).optional(),
});

const booleanFormField = z
  .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on")])
  .transform((value) => value === true || value === "true" || value === "on");

function optionalFormNumber(
  schema: z.ZodType<number>,
) {
  return z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? undefined : value),
    schema.optional(),
  );
}

export const serviceBookingRulesSchema = z
  .object({
    useCustomBookingRules: booleanFormField.default(false),
    slotIntervalValue: optionalFormNumber(z.coerce.number().int().min(1).max(480)),
    slotIntervalUnit: z.enum(["minutes", "hours"]).optional(),
    defaultDurationValue: optionalFormNumber(z.coerce.number().int().min(1).max(480)),
    defaultDurationUnit: z.enum(["minutes", "hours"]).optional(),
    minNoticeValue: optionalFormNumber(z.coerce.number().int().min(0).max(365)),
    minNoticeUnit: z.enum(["minutes", "hours", "days", "weeks"]).optional(),
    maxAdvanceValue: optionalFormNumber(z.coerce.number().int().min(1).max(365)),
    maxAdvanceUnit: z.enum(["days", "weeks", "months"]).optional(),
    bufferBeforeValue: optionalFormNumber(z.coerce.number().int().min(0).max(480)),
    bufferBeforeUnit: z.enum(["minutes", "hours"]).optional(),
    bufferAfterValue: optionalFormNumber(z.coerce.number().int().min(0).max(480)),
    bufferAfterUnit: z.enum(["minutes", "hours"]).optional(),
    maxBookingsPerDay: optionalFormNumber(z.coerce.number().int().min(0).max(999)),
    maxBookingsPerSlot: optionalFormNumber(z.coerce.number().int().min(1).max(99)),
    lookBusyEnabled: booleanFormField.optional(),
    lookBusyPercent: optionalFormNumber(z.coerce.number().int().min(0).max(100)),
  })
  .superRefine((data, ctx) => {
    if (
      data.useCustomBookingRules &&
      (data.defaultDurationValue == null || data.defaultDurationValue < 1)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Meeting duration is required when booking rules are enabled",
        path: ["defaultDurationValue"],
      });
    }
  });

export const serviceCreateWithRulesSchema = serviceCreateSchema.merge(
  serviceBookingRulesSchema,
);

export const serviceUpdateSchema = serviceCreateSchema.partial();

export const meetingTypeCreateSchema = z.object({
  name: z.string().min(1).max(200),
  subtitle: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  type: z
    .enum(["ZOOM", "GOOGLE_MEET", "PHONE", "WHATSAPP", "IN_STORE", "CUSTOM"])
    .default("CUSTOM"),
  videoLinkEnabled: z.boolean().default(false),
  imageUrl: z.union([z.string().url(), z.literal("")]).optional(),
  active: z.boolean().default(true),
});

export const meetingTypeUpdateSchema = meetingTypeCreateSchema.partial();

export const availabilityRuleSchema = z.object({
  dayOfWeek: z.enum([
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ]),
  enabled: z.boolean(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
});

export const availabilityUpdateSchema = z.object({
  rules: z
    .array(availabilityRuleSchema)
    .refine(
      (rules) =>
        rules.every(
          (rule) => !rule.enabled || isEndAfterStart(rule.startTime, rule.endTime),
        ),
      { message: "Closing time must be after opening time on each open day" },
    ),
});

export const availabilityDisplayPrefsSchema = z.object({
  hoursTimeFormat: z.enum(["HOUR_12", "HOUR_24"]),
  weekStartsOn: z.enum(["MONDAY", "SUNDAY"]),
});

export const bookingRulesSchema = z.object({
  slotIntervalValue: z.coerce.number().int().min(1).max(480),
  slotIntervalUnit: z.enum(["minutes", "hours"]),
  defaultDurationValue: z.coerce.number().int().min(1).max(480),
  defaultDurationUnit: z.enum(["minutes", "hours"]),
  minNoticeValue: z.coerce.number().int().min(0).max(365),
  minNoticeUnit: z.enum(["minutes", "hours", "days", "weeks"]),
  maxAdvanceValue: z.coerce.number().int().min(0).max(365),
  maxAdvanceUnit: z.enum(["days", "weeks", "months"]),
  bufferBeforeValue: z.coerce.number().int().min(0).max(480),
  bufferBeforeUnit: z.enum(["minutes", "hours"]),
  bufferAfterValue: z.coerce.number().int().min(0).max(480),
  bufferAfterUnit: z.enum(["minutes", "hours"]),
  maxBookingsPerDay: z.coerce.number().int().min(0).max(999),
  maxBookingsPerSlot: z.coerce.number().int().min(1).max(99),
  lookBusyEnabled: z
    .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on")])
    .transform((value) => value === true || value === "true" || value === "on"),
  lookBusyPercent: z.coerce.number().int().min(0).max(100),
});

export const closedDateRangeSchema = z
  .object({
    startDate: z.string().regex(dateRegex),
    endDate: z.string().regex(dateRegex),
    reason: z.string().max(500).optional(),
    closedAllDay: z
      .union([z.boolean(), z.literal("true"), z.literal("false")])
      .transform((v) => v === true || v === "true")
      .default(true),
    startTime: z.string().regex(timeRegex).optional(),
    endTime: z.string().regex(timeRegex).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  })
  .refine(
    (data) =>
      data.closedAllDay ||
      (Boolean(data.startTime) && Boolean(data.endTime)),
    {
      message: "Special hours require open and close times",
      path: ["startTime"],
    },
  )
  .refine(
    (data) => {
      if (data.closedAllDay || !data.startTime || !data.endTime) return true;
      return data.endTime > data.startTime;
    },
    {
      message: "Closing time must be after opening time",
      path: ["endTime"],
    },
  );

export const closedDateCreateSchema = closedDateRangeSchema.refine(
  (data) => isDateOnOrAfterToday(data.startDate),
  {
    message: "Start date cannot be in the past",
    path: ["startDate"],
  },
);

/** @deprecated use closedDateCreateSchema for new entries */
export const closedDateUpdateSchema = closedDateRangeSchema;

export const availabilityQuerySchema = z.object({
  shop: z.string().min(1),
  serviceId: z.string().min(1),
  date: z.string().regex(dateRegex).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export const bookingCreateSchema = z.object({
  shop: z.string().min(1),
  serviceId: z.string().min(1),
  meetingTypeId: z.string().min(1),
  date: z.string().regex(dateRegex),
  startTime: z.string().regex(timeRegex),
  customer: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().max(255),
    phone: z.string().max(50).optional(),
    note: z.string().max(2000).optional(),
  }),
});

export const bookingListQuerySchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
  serviceId: z.string().optional(),
  date: z.string().regex(dateRegex).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const bookingSlotsQuerySchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(dateRegex),
});

export const bookingRescheduleSchema = z.object({
  bookingId: z.string().min(1),
  date: z.string().regex(dateRegex),
  startTime: z.string().regex(timeRegex),
});

export const merchantSettingsSchema = z.object({
  timezone: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  locale: z.enum(["en", "fr", "de", "nl", "it", "es", "ru", "ar"]).optional(),
});

export function parseJsonBody<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false as const,
      errors: result.error.flatten(),
    };
  }
  return { success: true as const, data: result.data };
}

export function parseQuery<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams,
) {
  const raw = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false as const,
      errors: result.error.flatten(),
    };
  }
  return { success: true as const, data: result.data };
}
