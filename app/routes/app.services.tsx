import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { requireAdminMerchant } from "../lib/auth.server";
import {
  formStateToServiceBookingInput,
  isServiceBookingRulesComplete,
  emptyServiceBookingRulesFormState,
  serviceRecordToBookingRulesForm,
  type ServiceBookingRulesFormState,
} from "../lib/booking/booking-rules-form.shared";
import { getMerchantBookingRules } from "../lib/booking/booking-rules.server";
import {
  listServices,
  createService,
  updateService,
  deleteService,
  getService,
} from "../models/service.server";
import { listMeetingTypes } from "../models/meeting-type.server";
import { parseJsonBody, serviceCreateWithRulesSchema } from "../lib/validation/schemas";
import type { MeetingType } from "@prisma/client";
import type { ServiceWithMeetingTypes } from "../types/admin";
import { ImageUploadField } from "../components/admin/ImageUploadField";
import { MeetingTypePicker, MeetingTypeListReadonly } from "../components/admin/MeetingTypePicker";
import {
  ServiceBookingRulesFields,
  serviceBookingRulesHiddenInputs,
} from "../components/admin/ServiceBookingRulesFields";
import { CatalogTranslationsBanner } from "../components/admin/CatalogTranslationsBanner";
import { CatalogEntityTranslations } from "../components/admin/CatalogEntityTranslations";
import { ServiceModalShell } from "../components/admin/ServiceModalShell";
import { ServiceAccordion } from "../components/admin/ServiceAccordion";
import {
  loadCatalogTranslationsBanner,
  loadCatalogEntityTranslations,
  type CatalogEntityTranslationRow,
} from "../lib/widget/catalog-languages.server";
import {
  upsertServiceTextMetaobject,
  deleteCatalogTextMetaobject,
} from "../lib/widget/catalog-i18n-metaobject.server.js";
import { showAppToast, useFetcherIdleResult } from "../lib/admin/toast";
import { useAdminI18n } from "../lib/admin-i18n";
import "../components/admin/services.css";
import "../components/admin/booking-rules.css";
import "../components/admin/languages.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const catalogEntityId = url.searchParams.get("catalogEntityId");
  const { merchant, admin, session } = await requireAdminMerchant(request);

  if (catalogEntityId) {
    const service = await getService(merchant.id, catalogEntityId);
    if (!service) {
      return Response.json({ catalogEntity: null }, { status: 404 });
    }
    const catalogEntity = await loadCatalogEntityTranslations(
      admin,
      session,
      "service",
      { id: service.id, name: service.name },
    );
    return { catalogEntity };
  }

  const [services, meetingTypes] = await Promise.all([
    listServices(merchant.id),
    listMeetingTypes(merchant.id),
  ]);
  const catalogTranslations = await loadCatalogTranslationsBanner(
    admin,
    session,
    "service",
    services.map((s) => ({ id: s.id, name: s.name })),
  );
  return {
    services,
    meetingTypes,
    catalogTranslations,
  };
};

function buildServiceBookingRulesInput(parsed: {
  useCustomBookingRules: boolean;
  defaultDurationValue?: number;
  defaultDurationUnit?: "minutes" | "hours";
  slotIntervalValue?: number;
  slotIntervalUnit?: "minutes" | "hours";
  minNoticeValue?: number;
  minNoticeUnit?: "minutes" | "hours" | "days" | "weeks";
  maxAdvanceValue?: number;
  maxAdvanceUnit?: "days" | "weeks" | "months";
  bufferBeforeValue?: number;
  bufferBeforeUnit?: "minutes" | "hours";
  bufferAfterValue?: number;
  bufferAfterUnit?: "minutes" | "hours";
  maxBookingsPerDay?: number;
  maxBookingsPerSlot?: number;
  lookBusyEnabled?: boolean;
  lookBusyPercent?: number;
}) {
  if (!parsed.useCustomBookingRules) {
    return {
      bookingRules: { useCustomBookingRules: false as const },
      durationMinutes: undefined as number | undefined,
    };
  }

  const form: ServiceBookingRulesFormState = {
    ...emptyServiceBookingRulesFormState(),
    defaultDurationValue: parsed.defaultDurationValue ?? "",
    defaultDurationUnit: parsed.defaultDurationUnit ?? "minutes",
    slotIntervalValue: parsed.slotIntervalValue ?? "",
    slotIntervalUnit: parsed.slotIntervalUnit ?? "minutes",
    minNoticeValue: parsed.minNoticeValue ?? "",
    minNoticeUnit: parsed.minNoticeUnit ?? "minutes",
    maxAdvanceValue: parsed.maxAdvanceValue ?? "",
    maxAdvanceUnit: parsed.maxAdvanceUnit ?? "months",
    bufferBeforeValue: parsed.bufferBeforeValue ?? "",
    bufferBeforeUnit: parsed.bufferBeforeUnit ?? "minutes",
    bufferAfterValue: parsed.bufferAfterValue ?? "",
    bufferAfterUnit: parsed.bufferAfterUnit ?? "minutes",
    maxBookingsPerDay: parsed.maxBookingsPerDay ?? "",
    maxBookingsPerSlot: parsed.maxBookingsPerSlot ?? "",
    lookBusyEnabled: parsed.lookBusyEnabled === true,
    lookBusyPercent: parsed.lookBusyPercent ?? "",
  };

  return formStateToServiceBookingInput(form);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant, admin, session } = await requireAdminMerchant(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await deleteService(merchant.id, id);
    try {
      await deleteCatalogTextMetaobject(admin, "service", id);
    } catch {
      /* best-effort */
    }
    return { ok: true as const, action: "deleted" as const };
  }

  const body = {
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    active: formData.get("active") === "true",
    meetingTypeIds: formData.getAll("meetingTypeIds") as string[],
    useCustomBookingRules: formData.get("useCustomBookingRules"),
    slotIntervalValue: formData.get("slotIntervalValue") || undefined,
    slotIntervalUnit: formData.get("slotIntervalUnit") || undefined,
    defaultDurationValue: formData.get("defaultDurationValue") || undefined,
    defaultDurationUnit: formData.get("defaultDurationUnit") || undefined,
    minNoticeValue: formData.get("minNoticeValue") || undefined,
    minNoticeUnit: formData.get("minNoticeUnit") || undefined,
    maxAdvanceValue: formData.get("maxAdvanceValue") || undefined,
    maxAdvanceUnit: formData.get("maxAdvanceUnit") || undefined,
    bufferBeforeValue: formData.get("bufferBeforeValue") || undefined,
    bufferBeforeUnit: formData.get("bufferBeforeUnit") || undefined,
    bufferAfterValue: formData.get("bufferAfterValue") || undefined,
    bufferAfterUnit: formData.get("bufferAfterUnit") || undefined,
    maxBookingsPerDay: formData.get("maxBookingsPerDay") || undefined,
    maxBookingsPerSlot: formData.get("maxBookingsPerSlot") || undefined,
    lookBusyEnabled: formData.get("lookBusyEnabled") || undefined,
    lookBusyPercent: formData.get("lookBusyPercent") || undefined,
  };

  const parsed = parseJsonBody(serviceCreateWithRulesSchema, body);
  if (!parsed.success) {
    return { error: parsed.errors };
  }

  const merchantRules = await getMerchantBookingRules(merchant.id);
  const { bookingRules, durationMinutes: customDurationMinutes } =
    buildServiceBookingRulesInput(parsed.data);

  const servicePayload: {
    name: string;
    description?: string;
    imageUrl?: string;
    durationMinutes?: number;
    active: boolean;
    meetingTypeIds?: string[];
    bookingRules: typeof bookingRules;
  } = {
    name: parsed.data.name,
    description: parsed.data.description,
    imageUrl: parsed.data.imageUrl,
    active: parsed.data.active,
    meetingTypeIds: parsed.data.meetingTypeIds,
    bookingRules,
  };

  if (parsed.data.useCustomBookingRules) {
    servicePayload.durationMinutes = customDurationMinutes!;
  } else {
    servicePayload.durationMinutes = merchantRules.defaultDurationMinutes;
  }

  const id = formData.get("id") as string | null;
  let savedId: string;
  if (intent === "update" && id) {
    await updateService(merchant.id, id, servicePayload);
    savedId = id;
  } else {
    const created = await createService(merchant.id, {
      ...servicePayload,
      durationMinutes:
        servicePayload.durationMinutes ?? merchantRules.defaultDurationMinutes,
    });
    savedId = created.id;
  }

  let metaobjectError: string | undefined;
  try {
    await upsertServiceTextMetaobject(admin, session.shop, savedId, {
      name: parsed.data.name,
      description: parsed.data.description ?? "",
    });
  } catch (error) {
    metaobjectError =
      error instanceof Error ? error.message : "Could not save translation entry";
  }

  return {
    ok: true as const,
    action: "saved" as const,
    metaobjectError,
  };
};

function IconView() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 4C5.5 4 2 10 2 10s3.5 6 8 6 8-6 8-6-3.5-6-8-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M12.5 3.5l4 4-9 9H3.5v-4l9-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M11 5l4 4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 6h12M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6m2 0v9.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 15.5V6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M8 9v5M12 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function formatDurationLabel(minutes: number) {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours} hr ${remainder} min`;
  }
  return `${minutes} min`;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="ab-services__detail-row">
      <span className="ab-services__detail-label">{label}</span>
      <span className="ab-services__detail-value">{value}</span>
    </div>
  );
}

function ServiceViewDrawer({
  service,
  onClose,
  onEdit,
  catalogEntity,
  catalogLoading,
  metaobjectDefinitionName,
}: {
  service: ServiceWithMeetingTypes;
  onClose: () => void;
  onEdit: () => void;
  catalogEntity?: CatalogEntityTranslationRow | null;
  catalogLoading?: boolean;
  metaobjectDefinitionName: string;
}) {
  const { t } = useAdminI18n();
  const linkedMeetingTypes = service.meetingTypes.map((mt) => mt.meetingType);

  return (
    <ServiceModalShell
      title={service.name}
      subtitle={t("services.viewSubtitle")}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="ab-services__drawer-btn ab-services__drawer-btn--secondary"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
          <button
            type="button"
            className="ab-services__drawer-btn ab-services__drawer-btn--primary"
            onClick={onEdit}
          >
            {t("services.editService")}
          </button>
        </>
      }
    >
      <div className="ab-services__modal-stack">
        <ServiceAccordion
          title={t("services.sectionDetails")}
          description={t("services.sectionDetailsHint")}
          defaultOpen
        >
          <div className="ab-services-accordion__content">
            {service.imageUrl ? (
              <img
                src={service.imageUrl}
                alt=""
                className="ab-services__detail-image"
              />
            ) : null}
            <div className="ab-services__preview-grid">
              <DetailRow label={t("services.fieldName")} value={service.name} />
              <DetailRow
                label={t("bookingRules.meetingDuration")}
                value={formatDurationLabel(service.durationMinutes)}
              />
              {service.useCustomBookingRules ? (
                <DetailRow
                  label={t("services.bookingRulesLabel")}
                  value={t("services.customBookingRulesActive")}
                />
              ) : null}
              <DetailRow
                label={t("services.fieldStatus")}
                value={
                  <span
                    className={`ab-services__status ${service.active ? "ab-services__status--active" : "ab-services__status--inactive"}`}
                  >
                    {service.active ? t("services.statusActive") : t("services.statusInactive")}
                  </span>
                }
              />
            </div>
            <DetailRow label={t("services.fieldDescription")} value={service.description} />
          </div>
        </ServiceAccordion>

        <ServiceAccordion
          title={t("services.sectionMeetingTypes")}
          description={t("services.sectionMeetingTypesHint")}
          defaultOpen
          badge={
            linkedMeetingTypes.length > 0 ? (
              <span>{linkedMeetingTypes.length}</span>
            ) : undefined
          }
        >
          {linkedMeetingTypes.length === 0 ? (
            <p className="ab-services__hint">{t("services.noMeetingTypes")}</p>
          ) : (
            <MeetingTypeListReadonly meetingTypes={linkedMeetingTypes} />
          )}
        </ServiceAccordion>

        <ServiceAccordion
          title={t("services.sectionTranslations")}
          description={t("services.sectionTranslationsHint")}
        >
          {catalogLoading ? (
            <p className="ab-services__hint">{t("services.loadingTranslations")}</p>
          ) : (
            <CatalogEntityTranslations
              entity={catalogEntity}
              metaobjectDefinitionName={metaobjectDefinitionName}
              embedded
              translatableFieldLabels={[
                t("services.fieldName"),
                t("services.fieldDescription"),
              ]}
            />
          )}
        </ServiceAccordion>
      </div>
    </ServiceModalShell>
  );
}

function ServiceEditDrawer({
  service,
  meetingTypes,
  fetcher,
  isSubmitting,
  onClose,
  catalogEntity,
  catalogLoading,
  metaobjectDefinitionName,
}: {
  service: ServiceWithMeetingTypes | null;
  meetingTypes: MeetingType[];
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
  isSubmitting: boolean;
  onClose: () => void;
  catalogEntity?: CatalogEntityTranslationRow | null;
  catalogLoading?: boolean;
  metaobjectDefinitionName: string;
}) {
  const { t } = useAdminI18n();
  const isNew = service === null;
  const selectedIds =
    service?.meetingTypes.map((mt) => mt.meetingTypeId) ?? [];

  const initialBookingRules = useMemo(
    () => serviceRecordToBookingRulesForm(service),
    [service],
  );
  const [useCustomBookingRules, setUseCustomBookingRules] = useState(
    initialBookingRules.enabled,
  );
  const [bookingRulesForm, setBookingRulesForm] = useState(
    initialBookingRules.form,
  );

  useEffect(() => {
    setUseCustomBookingRules(initialBookingRules.enabled);
    setBookingRulesForm(initialBookingRules.form);
  }, [initialBookingRules]);

  function handleCustomRulesToggle(enabled: boolean) {
    setUseCustomBookingRules(enabled);
    if (enabled) {
      setBookingRulesForm(emptyServiceBookingRulesFormState());
    }
  }

  const bookingRulesIncomplete =
    useCustomBookingRules && !isServiceBookingRulesComplete(bookingRulesForm);

  const formId = "service-edit-form";
  const unsyncedCount =
    catalogEntity?.localeRows.filter((row) => !row.synced && !row.primary).length ?? 0;

  return (
    <ServiceModalShell
      title={isNew ? t("services.addTitle") : t("services.editTitle")}
      subtitle={isNew ? t("services.addSubtitle") : service?.name}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="ab-services__drawer-btn ab-services__drawer-btn--secondary"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form={formId}
            className="ab-services__drawer-btn ab-services__drawer-btn--primary"
            disabled={isSubmitting || bookingRulesIncomplete}
            title={
              bookingRulesIncomplete
                ? t("services.bookingRulesIncompleteHint")
                : undefined
            }
          >
            {isSubmitting ? t("common.saving") : t("services.saveService")}
          </button>
        </>
      }
    >
      <fetcher.Form id={formId} method="post" className="ab-services__modal-form">
        <input
          type="hidden"
          name="intent"
          value={isNew ? "create" : "update"}
        />
        {!isNew && service && <input type="hidden" name="id" value={service.id} />}
        {serviceBookingRulesHiddenInputs({
          enabled: useCustomBookingRules,
          form: bookingRulesForm,
        })}

        <div className="ab-services__modal-stack">
          <ServiceAccordion
            title={t("services.sectionDetails")}
            description={t("services.sectionDetailsHint")}
            defaultOpen
          >
            <div className="ab-services__form-grid">
              <div className="ab-services__form-field ab-services__form-field--highlight ab-services__form-field--full">
                <label className="ab-services__form-label" htmlFor="service-name">
                  {t("services.fieldName")}
                </label>
                <input
                  id="service-name"
                  className="ab-services__input"
                  name="name"
                  defaultValue={service?.name ?? ""}
                  required
                />
              </div>

              <div className="ab-services__form-field ab-services__form-field--highlight ab-services__form-field--full">
                <label className="ab-services__form-label" htmlFor="service-desc">
                  {t("services.fieldDescription")}
                </label>
                <textarea
                  id="service-desc"
                  className="ab-services__textarea"
                  name="description"
                  defaultValue={service?.description ?? ""}
                />
              </div>

              <div className="ab-services__form-field--full">
                <ImageUploadField
                  key={service?.id ?? "new"}
                  defaultValue={service?.imageUrl}
                  label={t("services.fieldImage")}
                />
              </div>

              <div className="ab-services__form-field ab-services__form-field--highlight ab-services__form-field--full">
                <span className="ab-services__form-label">{t("services.fieldStatus")}</span>
                <label className="ab-services__checkbox-row ab-services__detail-card">
                  <input
                    type="checkbox"
                    name="active"
                    value="true"
                    defaultChecked={service?.active ?? true}
                  />
                  {t("services.activeOnStorefront")}
                </label>
              </div>
            </div>
          </ServiceAccordion>

          <ServiceAccordion
            title={t("services.sectionMeetingTypes")}
            description={t("services.sectionMeetingTypesHint")}
            defaultOpen
            badge={
              selectedIds.length > 0 ? <span>{selectedIds.length}</span> : undefined
            }
          >
            <MeetingTypePicker
              meetingTypes={meetingTypes}
              defaultSelectedIds={selectedIds}
              emptyMessage={t("services.noMeetingTypesCreateFirst")}
            />
          </ServiceAccordion>

          <ServiceAccordion
            title={t("services.customBookingRules")}
            description={t("services.customBookingRulesHint")}
            defaultOpen={useCustomBookingRules}
            badge={
              useCustomBookingRules ? (
                <span>{t("services.customBookingRulesActive")}</span>
              ) : undefined
            }
          >
            <ServiceBookingRulesFields
              enabled={useCustomBookingRules}
              onEnabledChange={handleCustomRulesToggle}
              form={bookingRulesForm}
              onChange={setBookingRulesForm}
              embedded
            />
          </ServiceAccordion>

          {!isNew ? (
            <ServiceAccordion
              title={t("services.sectionTranslations")}
              description={t("services.sectionTranslationsHint")}
              badge={
                unsyncedCount > 0 ? (
                  <span>{unsyncedCount}</span>
                ) : undefined
              }
            >
              {catalogLoading ? (
                <p className="ab-services__hint">{t("services.loadingTranslations")}</p>
              ) : (
                <CatalogEntityTranslations
                  entity={catalogEntity}
                  metaobjectDefinitionName={metaobjectDefinitionName}
                  embedded
                  translatableFieldLabels={[
                    t("services.fieldName"),
                    t("services.fieldDescription"),
                  ]}
                />
              )}
            </ServiceAccordion>
          ) : null}
        </div>
      </fetcher.Form>
    </ServiceModalShell>
  );
}

export default function ServicesPage() {
  const {
    services,
    meetingTypes,
    catalogTranslations,
  } = useLoaderData<typeof loader>();
  const { t } = useAdminI18n();
  const fetcher = useFetcher<typeof action>();
  const catalogFetcher = useFetcher<typeof loader>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const isSubmitting = fetcher.state !== "idle";

  const typedServices = services as ServiceWithMeetingTypes[];
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  const stats = useMemo(() => {
    const active = typedServices.filter((s) => s.active).length;
    return {
      total: typedServices.length,
      active,
      inactive: typedServices.length - active,
    };
  }, [typedServices]);

  const filteredServices = useMemo(() => {
    if (statusFilter === "active") return typedServices.filter((s) => s.active);
    if (statusFilter === "inactive") return typedServices.filter((s) => !s.active);
    return typedServices;
  }, [typedServices, statusFilter]);

  const viewService =
    viewId != null ? typedServices.find((s) => s.id === viewId) ?? null : null;
  const editService =
    editId === "new"
      ? null
      : editId != null
        ? typedServices.find((s) => s.id === editId) ?? null
        : null;

  useFetcherIdleResult(fetcher, (data) => {
    if (typeof data !== "object" || data == null) return;
    if ("ok" in data && data.ok) {
      if ("action" in data && data.action === "deleted") {
        showAppToast(shopify, "Service deleted");
        setViewId(null);
        setEditId(null);
      } else {
        showAppToast(shopify, "Service saved");
        if (
          "metaobjectError" in data &&
          typeof data.metaobjectError === "string"
        ) {
          showAppToast(shopify, data.metaobjectError, { isError: true });
        }
        setEditId(null);
      }
      revalidator.revalidate();
      return;
    }
    if ("error" in data && data.error) {
      showAppToast(shopify, "Could not save service", { isError: true });
    }
  });

  useEffect(() => {
    if (!viewId && !editId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setViewId(null);
        setEditId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewId, editId]);

  useEffect(() => {
    const catalogServiceId =
      editId && editId !== "new" ? editId : viewId && viewId !== "new" ? viewId : null;
    if (catalogServiceId) {
      catalogFetcher.load(`/app/services?catalogEntityId=${catalogServiceId}`);
    }
  }, [editId, viewId]);

  function openEdit(id: string | "new") {
    setViewId(null);
    setEditId(id);
  }

  return (
    <s-page heading={t("services.pageTitle")}>
      <CatalogTranslationsBanner
        unsyncedLocaleLabels={catalogTranslations.unsyncedLocaleLabels}
        metaobjectDefinitionName={catalogTranslations.metaobjectDefinitionName}
        hasAnyUnsynced={catalogTranslations.hasAnyUnsynced}
      />
      <div className="ab-services">
        <div className="ab-services__stats">
          <div className="ab-services__stat">
            <div className="ab-services__stat-value">{stats.total}</div>
            <div className="ab-services__stat-label">Total services</div>
          </div>
          <div className="ab-services__stat ab-services__stat--active">
            <div className="ab-services__stat-value">{stats.active}</div>
            <div className="ab-services__stat-label">Active</div>
          </div>
          <div className="ab-services__stat ab-services__stat--inactive">
            <div className="ab-services__stat-value">{stats.inactive}</div>
            <div className="ab-services__stat-label">Inactive</div>
          </div>
        </div>

        <div className="ab-services__panel">
          <div className="ab-services__toolbar">
            <p className="ab-services__toolbar-title">Your services</p>
            <div className="ab-services__toolbar-actions">
              <div className="ab-services__field">
                <label className="ab-services__label" htmlFor="filter-status">
                  Status
                </label>
                <select
                  id="filter-status"
                  className="ab-services__select"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "" | "active" | "inactive")
                  }
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <button
                type="button"
                className="ab-services__btn-primary"
                onClick={() => openEdit("new")}
              >
                Add service
              </button>
            </div>
          </div>

          <div className="ab-services__summary">
            Showing {filteredServices.length} of {stats.total} service
            {stats.total === 1 ? "" : "s"}
          </div>

          {filteredServices.length === 0 ? (
            <div className="ab-services__empty">
              <div className="ab-services__empty-icon" aria-hidden>
                ✂️
              </div>
              <h3 className="ab-services__empty-title">
                {statusFilter ? "No services match your filter" : "No services yet"}
              </h3>
              <p className="ab-services__empty-text">
                {statusFilter
                  ? "Try changing the status filter."
                  : "Add bookable services that customers can choose on your storefront."}
              </p>
              {!statusFilter && (
                <button
                  type="button"
                  className="ab-services__btn-primary"
                  onClick={() => openEdit("new")}
                >
                  Add your first service
                </button>
              )}
            </div>
          ) : (
            <table className="ab-services-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <div className="ab-services__name">{service.name}</div>
                      {service.description && (
                        <div className="ab-services__meta">
                          {service.description.length > 60
                            ? `${service.description.slice(0, 60)}…`
                            : service.description}
                        </div>
                      )}
                    </td>
                    <td>{service.durationMinutes} min</td>
                    <td>
                      <span
                        className={`ab-services__status ${service.active ? "ab-services__status--active" : "ab-services__status--inactive"}`}
                      >
                        {service.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="ab-services__actions">
                        <button
                          type="button"
                          className="ab-services__icon-btn ab-services__icon-btn--view"
                          aria-label="View service"
                          title="View details"
                          onClick={() => {
                            setEditId(null);
                            setViewId(service.id);
                          }}
                        >
                          <IconView />
                        </button>
                        <button
                          type="button"
                          className="ab-services__icon-btn ab-services__icon-btn--edit"
                          aria-label="Edit service"
                          title="Edit"
                          onClick={() => openEdit(service.id)}
                        >
                          <IconEdit />
                        </button>
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={service.id} />
                          <button
                            type="submit"
                            className="ab-services__icon-btn ab-services__icon-btn--delete"
                            aria-label="Delete service"
                            title="Delete"
                            disabled={isSubmitting}
                            onClick={(e) => {
                              if (
                                !confirm(
                                  `Delete "${service.name}"? This cannot be undone.`,
                                )
                              ) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <IconTrash />
                          </button>
                        </fetcher.Form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewService && (
        <ServiceViewDrawer
          service={viewService}
          onClose={() => setViewId(null)}
          onEdit={() => openEdit(viewService.id)}
          catalogEntity={
            viewService && catalogFetcher.data?.catalogEntity
              ? catalogFetcher.data.catalogEntity
              : undefined
          }
          catalogLoading={catalogFetcher.state !== "idle"}
          metaobjectDefinitionName={catalogTranslations.metaobjectDefinitionName}
        />
      )}

      {editId != null && (
        <ServiceEditDrawer
          service={editService}
          meetingTypes={meetingTypes as MeetingType[]}
          fetcher={fetcher}
          isSubmitting={isSubmitting}
          onClose={() => setEditId(null)}
          catalogEntity={
            editService && catalogFetcher.data?.catalogEntity
              ? catalogFetcher.data.catalogEntity
              : undefined
          }
          catalogLoading={
            Boolean(editService) && catalogFetcher.state !== "idle"
          }
          metaobjectDefinitionName={catalogTranslations.metaobjectDefinitionName}
        />
      )}
    </s-page>
  );
}

export const headers = boundary.headers;
