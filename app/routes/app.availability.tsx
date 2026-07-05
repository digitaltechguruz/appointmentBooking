import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { AvailabilityRule, ClosedDate, DayOfWeek } from "@prisma/client";
import { requireAdminMerchant } from "../lib/auth.server";
import { updateMerchantSettings } from "../models/merchant.server";
import { formatTimezoneLabel } from "../lib/booking/timezone";
import {
  getAvailabilityRules,
  upsertAvailabilityRules,
  listClosedDates,
  addClosedDateRange,
  updateClosedDateRange,
  removeClosedDate,
  removeClosedDates,
} from "../models/availability.server";
import {
  availabilityUpdateSchema,
  availabilityDisplayPrefsSchema,
  closedDateCreateSchema,
  closedDateUpdateSchema,
  parseJsonBody,
  todayDateString,
} from "../lib/validation/schemas";
import { runAvailabilityAction } from "../lib/prisma-errors.server";
import {
  saveAvailabilityDisplayPrefs,
  type AvailabilityDisplayPrefs,
} from "../lib/admin/availability-display-prefs";
import { DAYS_OF_WEEK, HOLIDAYS_PREMIUM_MESSAGE } from "../lib/constants";
import { hasPremiumAccess } from "../models/subscription.server";
import { parseTimeToMinutes, minCloseTimeAfter } from "../lib/booking/time";
import {
  CopyHoursButton,
  CopyTimesPopover,
  TimePickerSelect,
  formatTimeDisplay,
  getWeekDisplayOrder,
  type HoursTimeFormat,
} from "../components/admin/time-pickers";
import { showAppToast, useFetcherIdleResult } from "../lib/admin/toast";
import { useAdminI18n } from "../lib/admin-i18n";
import "../components/admin/availability.css";

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

type DayRuleState = {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function countDaysInRange(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

function formatScheduledDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatScheduledRange(cd: ClosedDate) {
  const startLabel = formatScheduledDate(cd.date);
  const endLabel = formatScheduledDate(cd.endDate);
  const days = countDaysInRange(cd.date, cd.endDate);
  const primary =
    startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
  const secondary = days === 1 ? "1 day" : `${days} days`;
  return { primary, secondary, days };
}

function buildInitialDayRules(
  rules: AvailabilityRule[],
  weekOrder: DayOfWeek[],
): DayRuleState[] {
  const ruleMap = Object.fromEntries(rules.map((r) => [r.dayOfWeek, r]));
  return weekOrder.map((day) => {
    const rule = ruleMap[day];
    return {
      dayOfWeek: day,
      enabled: rule?.enabled ?? false,
      startTime: rule?.startTime ?? "09:00",
      endTime: rule?.endTime ?? "17:00",
    };
  });
}

function isValidDayHours(rule: DayRuleState) {
  if (!rule.enabled) return true;
  return parseTimeToMinutes(rule.endTime) > parseTimeToMinutes(rule.startTime);
}

function rulesSignature(rules: AvailabilityRule[]) {
  return JSON.stringify(
    rules.map((r) => ({
      day: r.dayOfWeek,
      enabled: r.enabled,
      start: r.startTime,
      end: r.endTime,
    })),
  );
}

function formatActionError(error: unknown) {
  if (!error || typeof error !== "object") return "Something went wrong";
  const record = error as Record<string, unknown>;
  if (typeof record._form === "string") return record._form;

  const flattened = error as {
    formErrors?: string[];
    fieldErrors?: Record<string, string[]>;
  };
  if (flattened.formErrors?.length) return flattened.formErrors[0];
  for (const messages of Object.values(flattened.fieldErrors ?? {})) {
    if (messages?.length) return messages[0];
  }

  const values = Object.values(record).filter((v) => typeof v === "string");
  return (values[0] as string | undefined) ?? "Validation failed";
}

function isClosedAllDay(cd: ClosedDate) {
  return cd.closedAllDay !== false;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const timezone = merchant.timezone ?? "UTC";

  const [rules, closedDates, hasPremium] = await Promise.all([
    getAvailabilityRules(merchant.id),
    listClosedDates(merchant.id),
    hasPremiumAccess(merchant.id),
  ]);
  return {
    shop: merchant.shop,
    rules,
    closedDates: hasPremium ? closedDates : [],
    hasPremium,
    timezone,
    timezoneLabel: formatTimezoneLabel(timezone),
    displayPrefs: {
      hoursTimeFormat:
        merchant.hoursTimeFormat === "HOUR_12" ? "HOUR_12" : "HOUR_24",
      weekStartsOn:
        merchant.weekStartsOn === "MONDAY" ? "MONDAY" : "SUNDAY",
    } satisfies AvailabilityDisplayPrefs,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "add-closed-range" || intent === "update-closed-range") {
    if (!(await hasPremiumAccess(merchant.id))) {
      return { error: HOLIDAYS_PREMIUM_MESSAGE };
    }

    const closedAllDay = formData.get("closedAllDay") !== "false";
    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate") || startDate;
    const body = {
      startDate,
      endDate,
      reason: formData.get("reason") || undefined,
      closedAllDay,
      startTime: closedAllDay ? undefined : formData.get("startTime") || undefined,
      endTime: closedAllDay ? undefined : formData.get("endTime") || undefined,
    };
    const schema =
      intent === "add-closed-range"
        ? closedDateCreateSchema
        : closedDateUpdateSchema;
    const parsed = parseJsonBody(schema, body);
    if (!parsed.success) return { error: parsed.errors };

    const result = await runAvailabilityAction(async () => {
      if (intent === "add-closed-range") {
        await addClosedDateRange(
          merchant.id,
          parsed.data.startDate,
          parsed.data.endDate,
          parsed.data.reason,
          parsed.data.closedAllDay,
          parsed.data.startTime,
          parsed.data.endTime,
        );
      } else {
        await updateClosedDateRange(
          merchant.id,
          formData.get("id") as string,
          parsed.data.startDate,
          parsed.data.endDate,
          parsed.data.reason,
          parsed.data.closedAllDay,
          parsed.data.startTime,
          parsed.data.endTime,
        );
      }
      return { ok: true as const };
    });
    return result;
  }

  if (intent === "remove-closed-range") {
    if (!(await hasPremiumAccess(merchant.id))) {
      return { error: HOLIDAYS_PREMIUM_MESSAGE };
    }
    const result = await runAvailabilityAction(async () => {
      await removeClosedDate(merchant.id, formData.get("id") as string);
      return { ok: true as const };
    });
    return result;
  }

  if (intent === "remove-closed-ranges") {
    if (!(await hasPremiumAccess(merchant.id))) {
      return { error: HOLIDAYS_PREMIUM_MESSAGE };
    }
    const ids = formData.getAll("ids") as string[];
    const result = await runAvailabilityAction(async () => {
      if (ids.length > 0) {
        await removeClosedDates(merchant.id, ids);
      }
      return { ok: true as const };
    });
    return result;
  }

  if (intent === "save-display-prefs") {
    const body = {
      hoursTimeFormat: formData.get("hoursTimeFormat"),
      weekStartsOn: formData.get("weekStartsOn"),
    };
    const parsed = parseJsonBody(availabilityDisplayPrefsSchema, body);
    if (!parsed.success) return { error: parsed.errors };

    const result = await runAvailabilityAction(async () => {
      await updateMerchantSettings(merchant.id, parsed.data);
      return { ok: true as const, savedDisplayPrefs: true as const };
    });
    return result;
  }

  if (intent === "save-hours") {
    const rules = DAYS_OF_WEEK.map((day) => ({
      dayOfWeek: day,
      enabled: formData.get(`enabled-${day}`) === "true",
      startTime: (formData.get(`start-${day}`) as string) || "09:00",
      endTime: (formData.get(`end-${day}`) as string) || "17:00",
    }));

    const parsed = parseJsonBody(availabilityUpdateSchema, { rules });
    if (!parsed.success) return { error: parsed.errors };

    const result = await runAvailabilityAction(async () => {
      await upsertAvailabilityRules(merchant.id, parsed.data.rules);
      return { ok: true as const, savedHours: true as const };
    });
    return result;
  }

  return { error: { _form: "Unknown action" } };
};

function SegmentToggle<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="ab-pref-group">
      <div className="ab-pref-label">{label}</div>
      <div
        className={`ab-segment${disabled ? " ab-segment--disabled" : ""}`}
        role="group"
        aria-label={label}
        aria-busy={disabled}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`ab-segment__btn${
              value === option.value ? " ab-segment__btn--active" : ""
            }`}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CopyHoursCell({
  rule,
  copySourceDay,
  weekOrder,
  onToggleCopy,
  onApplyCopy,
  onCloseCopy,
}: {
  rule: DayRuleState;
  copySourceDay: DayOfWeek | null;
  weekOrder: DayOfWeek[];
  onToggleCopy: (day: DayOfWeek) => void;
  onApplyCopy: (sourceDay: DayOfWeek, targets: DayOfWeek[]) => void;
  onCloseCopy: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const isOpen = copySourceDay === rule.dayOfWeek;

  return (
    <td className="ab-copy-cell">
      <CopyHoursButton
        ref={anchorRef}
        label={`Copy ${DAY_LABELS[rule.dayOfWeek]} times to other days`}
        active={isOpen}
        onClick={() => onToggleCopy(rule.dayOfWeek)}
      />
      {isOpen && (
        <CopyTimesPopover
          anchorRef={anchorRef}
          sourceDay={rule.dayOfWeek}
          days={weekOrder}
          dayLabels={DAY_LABELS}
          onApply={(targets) => onApplyCopy(rule.dayOfWeek, targets)}
          onClose={onCloseCopy}
        />
      )}
    </td>
  );
}

function WorkingHoursSection({
  rules,
  shop,
  displayPrefs,
  serverDisplayPrefs,
  timezoneLabel,
  onDisplayPrefsChange,
}: {
  rules: AvailabilityRule[];
  shop: string;
  displayPrefs: AvailabilityDisplayPrefs;
  serverDisplayPrefs: AvailabilityDisplayPrefs;
  timezoneLabel: string;
  onDisplayPrefsChange: (prefs: AvailabilityDisplayPrefs) => void;
}) {
  const shopify = useAppBridge();
  const hoursFetcher = useFetcher<typeof action>();
  const prefsFetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const { hoursTimeFormat, weekStartsOn } = displayPrefs;
  const weekOrder = useMemo(
    () => getWeekDisplayOrder(weekStartsOn),
    [weekStartsOn],
  );
  const [dayRules, setDayRules] = useState(() =>
    buildInitialDayRules(rules, weekOrder),
  );
  const [hoursDirty, setHoursDirty] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState<DayOfWeek | null>(null);
  const isSaving = hoursFetcher.state === "submitting";
  const isSavingPrefs = prefsFetcher.state !== "idle";
  const lastHoursSaveRef = useRef<unknown>(null);
  const lastPrefsSaveRef = useRef<unknown>(null);
  const serverRulesKey = useMemo(() => rulesSignature(rules), [rules]);

  useEffect(() => {
    if (hoursDirty) return;
    setDayRules(buildInitialDayRules(rules, weekOrder));
  }, [serverRulesKey, weekOrder, hoursDirty, rules]);

  useEffect(() => {
    if (!hoursDirty) return;
    setDayRules((prev) => {
      const byDay = new Map(prev.map((r) => [r.dayOfWeek, r]));
      return weekOrder.map((day) => byDay.get(day)!);
    });
  }, [weekOrder, hoursDirty]);

  useEffect(() => {
    const data = hoursFetcher.data;
    if (!data || hoursFetcher.state !== "idle") return;
    if (data === lastHoursSaveRef.current) return;

    if ("error" in data && data.error) {
      lastHoursSaveRef.current = data;
      showAppToast(shopify,formatActionError(data.error), { isError: true });
      return;
    }
    if ("ok" in data && data.ok && "savedHours" in data && data.savedHours) {
      lastHoursSaveRef.current = data;
      setHoursDirty(false);
      showAppToast(shopify,"Store hours saved");
      revalidator.revalidate();
    }
  }, [hoursFetcher.data, hoursFetcher.state, revalidator, shopify]);

  useEffect(() => {
    const data = prefsFetcher.data;
    if (!data || prefsFetcher.state !== "idle") return;
    if (data === lastPrefsSaveRef.current) return;

    if ("error" in data && data.error) {
      lastPrefsSaveRef.current = data;
      showAppToast(shopify,formatActionError(data.error), { isError: true });
      saveAvailabilityDisplayPrefs(shop, serverDisplayPrefs);
      onDisplayPrefsChange(serverDisplayPrefs);
      return;
    }
    if ("ok" in data && data.ok && "savedDisplayPrefs" in data && data.savedDisplayPrefs) {
      lastPrefsSaveRef.current = data;
      showAppToast(shopify,"Display settings saved");
      revalidator.revalidate();
    }
  }, [prefsFetcher.data, prefsFetcher.state, revalidator, serverDisplayPrefs, shop, shopify, onDisplayPrefsChange]);

  const allValid = dayRules.every(isValidDayHours);
  const invalidOpenDays = dayRules.filter(
    (rule) => rule.enabled && !isValidDayHours(rule),
  );

  const updateDisplayPref = <K extends keyof AvailabilityDisplayPrefs>(
    key: K,
    value: AvailabilityDisplayPrefs[K],
  ) => {
    if (value === displayPrefs[key] || isSavingPrefs) return;
    const next = { ...displayPrefs, [key]: value };
    saveAvailabilityDisplayPrefs(shop, next);
    onDisplayPrefsChange(next);
    prefsFetcher.submit(
      {
        intent: "save-display-prefs",
        hoursTimeFormat: next.hoursTimeFormat,
        weekStartsOn: next.weekStartsOn,
      },
      { method: "post" },
    );
  };

  const applyCopy = useCallback(
    (sourceDay: DayOfWeek, targets: DayOfWeek[]) => {
      if (targets.length === 0) return;
      setHoursDirty(true);
      let copiedAsClosed = false;
      setDayRules((prev) => {
        const source = prev.find((r) => r.dayOfWeek === sourceDay);
        if (!source) return prev;
        copiedAsClosed = !source.enabled;
        return prev.map((r) =>
          targets.includes(r.dayOfWeek)
            ? {
                ...r,
                startTime: source.startTime,
                endTime: source.endTime,
                enabled: source.enabled,
              }
            : r,
        );
      });
      setCopySourceDay(null);
      showAppToast(shopify,
        copiedAsClosed
          ? `Copied ${DAY_LABELS[sourceDay]} as closed to ${targets.length} day(s)`
          : `Copied ${DAY_LABELS[sourceDay]} hours to ${targets.length} day(s)`,
      );
    },
    [shopify],
  );

  const updateDay = (day: DayOfWeek, patch: Partial<DayRuleState>) => {
    setHoursDirty(true);
    setDayRules((prev) =>
      prev.map((r) => {
        if (r.dayOfWeek !== day) return r;
        const next = { ...r, ...patch };
        if (
          parseTimeToMinutes(next.endTime) <= parseTimeToMinutes(next.startTime)
        ) {
          next.endTime = minCloseTimeAfter(next.startTime);
        }
        return next;
      }),
    );
  };

  return (
    <s-section heading="Weekly working hours">
      <hoursFetcher.Form method="post">
        <input type="hidden" name="intent" value="save-hours" />
        {DAYS_OF_WEEK.map((day) => {
          const rule = dayRules.find((r) => r.dayOfWeek === day);
          if (!rule) return null;
          return (
            <div key={day}>
              <input
                type="hidden"
                name={`enabled-${day}`}
                value={rule.enabled ? "true" : "false"}
              />
              <input type="hidden" name={`start-${day}`} value={rule.startTime} />
              <input type="hidden" name={`end-${day}`} value={rule.endTime} />
            </div>
          );
        })}

      <div className="ab-card ab-hours-card">
        <div className="ab-pref-grid">
          <SegmentToggle
            label="Time format"
            value={hoursTimeFormat}
            disabled={isSavingPrefs}
            options={[
              { value: "HOUR_12", label: "12-hour (9:00 AM)" },
              { value: "HOUR_24", label: "24-hour (09:00)" },
            ]}
            onChange={(value) => updateDisplayPref("hoursTimeFormat", value)}
          />
          <SegmentToggle
            label="Week starts on"
            value={weekStartsOn}
            disabled={isSavingPrefs}
            options={[
              { value: "MONDAY", label: "Monday (Mon–Sun)" },
              { value: "SUNDAY", label: "Sunday (Sun–Sat)" },
            ]}
            onChange={(value) => updateDisplayPref("weekStartsOn", value)}
          />
        </div>

        <div className="ab-timezone-block">
          <span className="ab-pref-label">Store timezone</span>
          <span className="ab-timezone-value">{timezoneLabel}</span>
          <span className="ab-timezone-hint">
            Synced from Shopify. Working hours and bookings use this timezone.
          </span>
        </div>

        <div className="ab-hours-table-wrap">
        <table className="ab-hours-table">
            <colgroup>
              <col className="ab-col-day" />
              <col className="ab-col-hours" />
              <col className="ab-col-copy" />
              <col className="ab-col-status" />
              <col className="ab-col-closed" />
            </colgroup>
            <thead>
              <tr>
                <th>Day</th>
                <th>Hours</th>
                <th aria-hidden="true" />
                <th>Status</th>
                <th className="ab-hours-table__closed-head">Closed</th>
              </tr>
            </thead>
            <tbody>
              {dayRules.map((rule) => (
                <tr key={rule.dayOfWeek}>
                  <td className="ab-hours-table__day">{DAY_LABELS[rule.dayOfWeek]}</td>
                  <td className="ab-hours-table__hours">
                    {rule.enabled ? (
                      hoursTimeFormat === "HOUR_12" ? (
                        <div className="ab-hours-range ab-hours-range--12h">
                          <span className="ab-hours-range__label">Opens</span>
                          <TimePickerSelect
                            key={`open-${rule.dayOfWeek}-${rule.enabled}-${rule.startTime}`}
                            idPrefix={`open-${rule.dayOfWeek}`}
                            value={rule.startTime}
                            format={hoursTimeFormat}
                            onChange={(startTime) =>
                              updateDay(rule.dayOfWeek, { startTime })
                            }
                          />
                          <span className="ab-hours-range__sep" aria-hidden="true">
                            to
                          </span>
                          <span className="ab-hours-range__label">Closes</span>
                          <TimePickerSelect
                            key={`close-${rule.dayOfWeek}-${rule.enabled}-${rule.endTime}`}
                            idPrefix={`close-${rule.dayOfWeek}`}
                            value={rule.endTime}
                            format={hoursTimeFormat}
                            minTime={rule.startTime}
                            onChange={(endTime) =>
                              updateDay(rule.dayOfWeek, { endTime })
                            }
                          />
                        </div>
                      ) : (
                        <div className="ab-hours-range">
                          <div className="ab-hours-range__open">
                            <TimePickerSelect
                              key={`open-${rule.dayOfWeek}-${rule.enabled}-${rule.startTime}`}
                              idPrefix={`open-${rule.dayOfWeek}`}
                              value={rule.startTime}
                              format={hoursTimeFormat}
                              onChange={(startTime) =>
                                updateDay(rule.dayOfWeek, { startTime })
                              }
                            />
                          </div>
                          <span className="ab-hours-range__sep" aria-hidden="true">
                            to
                          </span>
                          <div className="ab-hours-range__close">
                            <TimePickerSelect
                              key={`close-${rule.dayOfWeek}-${rule.enabled}-${rule.endTime}`}
                              idPrefix={`close-${rule.dayOfWeek}`}
                              value={rule.endTime}
                              format={hoursTimeFormat}
                              minTime={rule.startTime}
                              onChange={(endTime) =>
                                updateDay(rule.dayOfWeek, { endTime })
                              }
                            />
                          </div>
                        </div>
                      )
                    ) : (
                      <span className="ab-dash">Closed all day</span>
                    )}
                  </td>
                  <CopyHoursCell
                    rule={rule}
                    copySourceDay={copySourceDay}
                    weekOrder={weekOrder}
                    onToggleCopy={(day) =>
                      setCopySourceDay((current) => (current === day ? null : day))
                    }
                    onApplyCopy={applyCopy}
                    onCloseCopy={() => setCopySourceDay(null)}
                  />
                  <td>
                    <span
                      className={`ab-status-badge ${
                        rule.enabled ? "ab-status-badge--open" : "ab-status-badge--closed"
                      }`}
                    >
                      {rule.enabled ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td className="ab-hours-table__closed">
                    <input
                      type="checkbox"
                      checked={!rule.enabled}
                      onChange={(e) =>
                        updateDay(rule.dayOfWeek, { enabled: !e.target.checked })
                      }
                      aria-label={`Mark ${DAY_LABELS[rule.dayOfWeek]} as closed`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          {!allValid && (
            <p className="ab-field-error">
              Closing time must be after opening time on each open day
              {invalidOpenDays.length > 0 && (
                <>
                  {" "}
                  (
                  {invalidOpenDays
                    .map((rule) => DAY_LABELS[rule.dayOfWeek])
                    .join(", ")}
                  )
                </>
              )}
              .
            </p>
          )}
        <p className="ab-validation-hint">
          {hoursDirty && !isSaving
            ? "You have unsaved changes."
            : "Set hours for each open day, then save."}
        </p>
        <button
          type="submit"
          className="ab-primary-btn"
          disabled={!allValid || isSaving}
        >
          {isSaving ? "Saving…" : "Save store hours"}
        </button>
      </div>
      </hoursFetcher.Form>
    </s-section>
  );
}

function HolidayForm({
  fetcher,
  editing,
  onCancel,
  hoursTimeFormat,
}: {
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
  editing: ClosedDate | null;
  onCancel: () => void;
  hoursTimeFormat: HoursTimeFormat;
}) {
  const today = todayDateString();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [closedAllDay, setClosedAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  useEffect(() => {
    if (!editing) {
      setStartDate("");
      setEndDate("");
      setClosedAllDay(true);
      setStartTime("09:00");
      setEndTime("17:00");
      return;
    }
    setStartDate(toInputDate(editing.date));
    setEndDate(toInputDate(editing.endDate));
    setClosedAllDay(isClosedAllDay(editing));
    setStartTime(editing.startTime ?? "09:00");
    setEndTime(editing.endTime ?? "17:00");
  }, [editing]);

  const startInPast = Boolean(startDate) && startDate < today && !editing;
  const endBeforeStart = Boolean(startDate && endDate) && endDate < startDate;
  const invalidTimes =
    !closedAllDay && Boolean(startTime && endTime) && endTime <= startTime;
  const canSubmit =
    Boolean(startDate) &&
    !startInPast &&
    !endBeforeStart &&
    (closedAllDay || (endTime > startTime && Boolean(startTime) && Boolean(endTime)));

  const minEndDate = startDate || today;

  return (
    <fetcher.Form method="post">
      <input
        type="hidden"
        name="intent"
        value={editing ? "update-closed-range" : "add-closed-range"}
      />
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <input type="hidden" name="closedAllDay" value={closedAllDay ? "true" : "false"} />
      {!closedAllDay && (
        <>
          <input type="hidden" name="startTime" value={startTime} />
          <input type="hidden" name="endTime" value={endTime} />
        </>
      )}

      <div className="ab-card">
        <h3 className="ab-card__title">{editing ? "Edit holiday" : "Add dates"}</h3>
        <p className="ab-card__hint">
          Pick a start date. Optionally pick an end date to add multiple days at once
          — leave end blank for a single day. Past dates cannot be selected.
        </p>

        <div className="ab-field-row">
          <div className="ab-field">
            <label htmlFor="holiday-start">Start date</label>
            <input
              id="holiday-start"
              type="date"
              name="startDate"
              required
              min={editing ? undefined : today}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate && endDate < e.target.value) setEndDate(e.target.value);
              }}
            />
            {startInPast && (
              <span className="ab-field-error">Start date cannot be in the past.</span>
            )}
          </div>
          <div className="ab-field">
            <label htmlFor="holiday-end">End date</label>
            <input
              id="holiday-end"
              type="date"
              name="endDate"
              min={minEndDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {endBeforeStart && (
              <span className="ab-field-error">
                End date must be on or after the start date.
              </span>
            )}
          </div>
        </div>

        <div className="ab-type-box">
          <div className="ab-type-box__row">
            <div>
              <div className="ab-type-box__label">Closed all day</div>
              <div className="ab-type-box__hint">
                {startDate
                  ? closedAllDay
                    ? "Bookings are unavailable for the selected date(s)."
                    : "Use special hours instead of your regular weekly schedule."
                  : "Select a start date to configure this holiday."}
              </div>
            </div>
            <label className="ab-toggle">
              <input
                type="checkbox"
                checked={closedAllDay}
                disabled={!startDate}
                onChange={(e) => setClosedAllDay(e.target.checked)}
              />
              <span className="ab-toggle__slider" />
            </label>
          </div>
        </div>

        <div className="ab-field-row">
          <div className="ab-field">
            <label>Opens (special)</label>
            <TimePickerSelect
              idPrefix="holiday-open"
              value={startTime}
              format={hoursTimeFormat}
              disabled={closedAllDay || !startDate}
              onChange={(nextStart) => {
                setStartTime(nextStart);
                if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(nextStart)) {
                  setEndTime(minCloseTimeAfter(nextStart));
                }
              }}
            />
          </div>
          <div className="ab-field">
            <label>Closes (special)</label>
            <TimePickerSelect
              idPrefix="holiday-close"
              value={endTime}
              format={hoursTimeFormat}
              minTime={startTime}
              disabled={closedAllDay || !startDate}
              onChange={setEndTime}
            />
          </div>
        </div>
        {invalidTimes && (
          <p className="ab-field-error">
            Closing time must be after opening time for special hours.
          </p>
        )}

        <div className="ab-form-actions">
          <button
            type="submit"
            className="ab-primary-btn"
            disabled={!canSubmit || fetcher.state !== "idle"}
          >
            {fetcher.state !== "idle"
              ? "Saving…"
              : editing
                ? "Save holiday"
                : "Add holiday"}
          </button>
          {editing && (
            <button type="button" className="ab-secondary-btn" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </fetcher.Form>
  );
}

export default function AvailabilityPage() {
  const {
    shop,
    rules,
    closedDates,
    hasPremium,
    timezoneLabel,
    displayPrefs: loaderDisplayPrefs,
  } = useLoaderData<typeof loader>();
  const { t } = useAdminI18n();
  const fetcher = useFetcher<typeof action>();
  const billingFetcher = useFetcher();
  const shopify = useAppBridge();
  const [displayPrefs, setDisplayPrefs] = useState(loaderDisplayPrefs);
  const [editingClosedId, setEditingClosedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setDisplayPrefs(loaderDisplayPrefs);
    saveAvailabilityDisplayPrefs(shop, loaderDisplayPrefs);
  }, [loaderDisplayPrefs, shop]);

  useFetcherIdleResult(fetcher, (data) => {
    if (typeof data !== "object" || data == null) return;
    if ("error" in data && data.error) {
      showAppToast(shopify, formatActionError(data.error), { isError: true });
      return;
    }
    if ("ok" in data && data.ok && !("savedDisplayPrefs" in data)) {
      showAppToast(shopify, "Saved");
      setEditingClosedId(null);
      setSelectedIds([]);
    }
  });

  const editingClosed = (closedDates as ClosedDate[]).find(
    (cd) => cd.id === editingClosedId,
  );

  const scheduledSummary = useMemo(() => {
    const entries = closedDates as ClosedDate[];
    const totalDays = entries.reduce(
      (sum, cd) => sum + countDaysInRange(cd.date, cd.endDate),
      0,
    );
    return { count: entries.length, totalDays };
  }, [closedDates]);

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    );
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(
      checked ? (closedDates as ClosedDate[]).map((cd) => cd.id) : [],
    );
  };

  return (
    <s-page heading={t("availability.pageTitle")}>
      <div className="ab-availability">
        <WorkingHoursSection
          rules={rules}
          shop={shop}
          displayPrefs={displayPrefs}
          serverDisplayPrefs={loaderDisplayPrefs}
          timezoneLabel={timezoneLabel}
          onDisplayPrefsChange={setDisplayPrefs}
        />

        <s-section heading="Holidays & special hours">
          <div className="ab-card">
            <div className="ab-card__title-row">
              <h3 className="ab-card__title">About holidays & special hours</h3>
              {!hasPremium ? <span className="ab-pro-badge">Pro</span> : null}
            </div>
            <ul className="ab-about-list">
              <li>These override your regular weekly schedule for specific dates.</li>
              <li>Set <strong>Closed all day</strong> for holidays when bookings are unavailable.</li>
              <li>
                Or turn off closed all day to set <strong>special hours</strong> (e.g. 10:00 – 14:00
                on Christmas Eve).
              </li>
            </ul>
          </div>

          {!hasPremium ? (
            <div className="ab-card ab-pro-lock">
              <p className="ab-pro-lock__text">{HOLIDAYS_PREMIUM_MESSAGE}</p>
              <billingFetcher.Form method="post" action="/app/billing">
                <s-button
                  type="submit"
                  variant="primary"
                  loading={billingFetcher.state !== "idle"}
                >
                  Upgrade now
                </s-button>
              </billingFetcher.Form>
            </div>
          ) : (
            <>
          <HolidayForm
            fetcher={fetcher}
            editing={editingClosed ?? null}
            onCancel={() => setEditingClosedId(null)}
            hoursTimeFormat={displayPrefs.hoursTimeFormat}
          />

          {(closedDates as ClosedDate[]).length > 0 && (
            <div className="ab-card">
              <div className="ab-scheduled-header">
                <h3 className="ab-card__title" style={{ margin: 0 }}>
                  Scheduled dates ({scheduledSummary.count}) · {scheduledSummary.totalDays}{" "}
                  {scheduledSummary.totalDays === 1 ? "day" : "days"}
                </h3>
                {selectedIds.length > 0 && (
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="remove-closed-ranges" />
                    {selectedIds.map((id) => (
                      <input key={id} type="hidden" name="ids" value={id} />
                    ))}
                    <s-button type="submit" tone="critical">
                      Remove selected
                    </s-button>
                  </fetcher.Form>
                )}
              </div>

              <table className="ab-scheduled-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.length > 0 &&
                          selectedIds.length === (closedDates as ClosedDate[]).length
                        }
                        onChange={(e) => toggleAll(e.target.checked)}
                        aria-label="Select all scheduled dates"
                      />
                    </th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Hours</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(closedDates as ClosedDate[]).map((cd) => {
                    const { primary, secondary } = formatScheduledRange(cd);
                    return (
                      <tr key={cd.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(cd.id)}
                            onChange={(e) => toggleSelected(cd.id, e.target.checked)}
                            aria-label={`Select ${primary}`}
                          />
                        </td>
                        <td>
                          <div className="ab-date-cell__primary">{primary}</div>
                          <div className="ab-date-cell__secondary">{secondary}</div>
                        </td>
                        <td>
                          <span
                            className={`ab-type-badge ${
                              isClosedAllDay(cd)
                                ? "ab-type-badge--closed"
                                : "ab-type-badge--special"
                            }`}
                          >
                            {isClosedAllDay(cd) ? "Closed all day" : "Special hours"}
                          </span>
                        </td>
                        <td>
                          {isClosedAllDay(cd)
                            ? "All day"
                            : cd.startTime && cd.endTime
                              ? `${formatTimeDisplay(cd.startTime, displayPrefs.hoursTimeFormat)} – ${formatTimeDisplay(cd.endTime, displayPrefs.hoursTimeFormat)}`
                              : "—"}
                        </td>
                        <td>
                          <div className="ab-actions">
                            <button
                              type="button"
                              className="ab-btn-link"
                              onClick={() => setEditingClosedId(cd.id)}
                            >
                              Edit
                            </button>
                            <fetcher.Form method="post">
                              <input type="hidden" name="intent" value="remove-closed-range" />
                              <input type="hidden" name="id" value={cd.id} />
                              <button type="submit" className="ab-btn-link ab-btn-link--critical">
                                Remove
                              </button>
                            </fetcher.Form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
            </>
          )}
        </s-section>
      </div>
    </s-page>
  );
}

export const headers = boundary.headers;
