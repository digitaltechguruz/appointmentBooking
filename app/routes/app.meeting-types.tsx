import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useRevalidator, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { requireAdminMerchant } from "../lib/auth.server";
import {
  listMeetingTypes,
  createMeetingType,
  updateMeetingType,
  deleteMeetingType,
} from "../models/meeting-type.server";
import type { MeetingType } from "@prisma/client";
import { meetingTypeHasVideoLink, type IntegrationConnections } from "../lib/constants";
import {
  parseJsonBody,
  meetingTypeCreateSchema,
} from "../lib/validation/schemas";
import { getIntegrationStatus } from "../lib/integrations/status.server";
import { showAppToast, useFetcherIdleResult } from "../lib/admin/toast";
import { useAdminI18n } from "../lib/admin-i18n";
import { createServerI18n } from "../lib/admin-i18n.server.js";
import { ImageUploadField } from "../components/admin/ImageUploadField";
import { CatalogTranslationsBanner } from "../components/admin/CatalogTranslationsBanner";
import { CatalogEntityTranslations } from "../components/admin/CatalogEntityTranslations";
import { ServiceAccordion } from "../components/admin/ServiceAccordion";
import { ServiceModalShell } from "../components/admin/ServiceModalShell";
import {
  loadCatalogTranslationsBanner,
  loadCatalogEntityTranslations,
  type CatalogEntityTranslationRow,
} from "../lib/widget/catalog-languages.server";
import {
  upsertMeetingTypeTextMetaobject,
  deleteCatalogTextMetaobject,
} from "../lib/widget/catalog-i18n-metaobject.server.js";
import "../components/admin/services.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const catalogEntityId = url.searchParams.get("catalogEntityId");
  const { merchant, admin, session } = await requireAdminMerchant(request);

  if (catalogEntityId) {
    const meetingTypes = await listMeetingTypes(merchant.id);
    const item = meetingTypes.find((row) => row.id === catalogEntityId);
    if (!item) {
      return Response.json({ catalogEntity: null }, { status: 404 });
    }
    const catalogEntity = await loadCatalogEntityTranslations(
      admin,
      session,
      "meetingType",
      { id: item.id, name: item.name },
    );
    return { catalogEntity };
  }

  const [meetingTypes, integrations] = await Promise.all([
    listMeetingTypes(merchant.id),
    getIntegrationStatus(merchant.id),
  ]);
  const catalogTranslations = await loadCatalogTranslationsBanner(
    admin,
    session,
    "meetingType",
    meetingTypes.map((mt) => ({ id: mt.id, name: mt.name })),
  );
  return { meetingTypes, integrations, catalogTranslations };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { merchant, admin, session } = await requireAdminMerchant(request);
  const { t } = await createServerI18n(request, session, {
    admin,
    shopDomain: session.shop,
  });
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    const id = formData.get("id") as string;
    const result = await deleteMeetingType(
      merchant.id,
      id,
    );
    try {
      await deleteCatalogTextMetaobject(admin, "meetingType", id);
    } catch {
      /* best-effort */
    }
    if (result.deleted) {
      return { ok: true as const, action: "deleted" as const };
    }
    return {
      ok: true as const,
      action: "deactivated" as const,
      bookingCount: result.bookingCount,
    };
  }

  const body = {
    name: formData.get("name"),
    subtitle: formData.get("subtitle") || undefined,
    description: formData.get("description") || undefined,
    type: "CUSTOM",
    videoLinkEnabled: formData.get("videoLinkEnabled") === "true",
    imageUrl: formData.get("imageUrl") || undefined,
    active: formData.get("active") === "true",
  };

  const parsed = parseJsonBody(meetingTypeCreateSchema, body);
  if (!parsed.success) return { error: parsed.errors };

  const connections = await getIntegrationStatus(merchant.id);
  if (parsed.data.videoLinkEnabled && !connections.google && !connections.zoom) {
    return {
      error: t("meetingTypes.connectIntegrationsFirst"),
    };
  }

  const id = formData.get("id") as string | null;
  let savedId: string;
  if (intent === "update" && id) {
    await updateMeetingType(merchant.id, id, parsed.data);
    savedId = id;
  } else {
    const created = await createMeetingType(merchant.id, parsed.data);
    savedId = created.id;
  }

  let metaobjectError: string | undefined;
  try {
    await upsertMeetingTypeTextMetaobject(admin, session.shop, savedId, {
      name: parsed.data.name,
      subtitle: parsed.data.subtitle ?? "",
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

function meetingTypeSubtitle(
  mt: MeetingType,
  t: (key: string) => string,
) {
  if (mt.subtitle) return mt.subtitle;
  if (meetingTypeHasVideoLink(mt)) return t("meetingTypes.videoLink");
  return t("meetingTypes.standard");
}

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

function IconClose() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
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

function MeetingTypeViewDrawer({
  item,
  onClose,
  onEdit,
}: {
  item: MeetingType;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { t } = useAdminI18n();
  const hasVideo = meetingTypeHasVideoLink(item);

  return (
    <div
      className="ab-services__overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ab-services__drawer" role="dialog" aria-modal="true">
        <div className="ab-services__drawer-header">
          <h2 className="ab-services__drawer-title">{item.name}</h2>
          <button
            type="button"
            className="ab-services__icon-btn"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>

        <div className="ab-services__drawer-body">
          {item.imageUrl && (
            <div className="ab-services__detail-section">
              <img
                src={item.imageUrl}
                alt=""
                className="ab-services__detail-image"
              />
            </div>
          )}

          <div className="ab-services__detail-section">
            <h3 className="ab-services__detail-heading">{t("meetingTypes.detailsHeading")}</h3>
            <div className="ab-services__detail-grid">
              <DetailRow label={t("common.name")} value={item.name} />
              <DetailRow label={t("common.subtitle")} value={item.subtitle} />
              <DetailRow label={t("common.description")} value={item.description} />
              <DetailRow
                label={t("meetingTypes.videoLink")}
                value={hasVideo ? t("common.enabled") : t("common.off")}
              />
              <DetailRow
                label={t("common.status")}
                value={
                  <span
                    className={`ab-services__status ${item.active ? "ab-services__status--active" : "ab-services__status--inactive"}`}
                  >
                    {item.active ? t("common.active") : t("common.inactive")}
                  </span>
                }
              />
            </div>
          </div>
        </div>

        <div className="ab-services__drawer-footer">
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
            {t("meetingTypes.editTitle")}
          </button>
        </div>
      </div>
    </div>
  );
}

function IntegrationStatusPanel({
  integrations,
}: {
  integrations: IntegrationConnections;
}) {
  const { t } = useAdminI18n();
  return (
    <ul className="ab-services__integration-status">
      <li
        className={
          integrations.google
            ? "ab-services__integration--on"
            : "ab-services__integration--off"
        }
      >
        {t("meetingTypes.googleMeet")}
        <span className="ab-services__integration-sep" aria-hidden>
          ·
        </span>
        {integrations.google
          ? (integrations.googleEmail ?? t("common.connected"))
          : t("common.notConnected")}
      </li>
      <li
        className={
          integrations.zoom
            ? "ab-services__integration--on"
            : "ab-services__integration--off"
        }
      >
        {t("dashboard.zoomTitle")}
        <span className="ab-services__integration-sep" aria-hidden>
          ·
        </span>
        {integrations.zoom
          ? (integrations.zoomEmail ?? t("common.connected"))
          : t("common.notConnected")}
      </li>
    </ul>
  );
}

function MeetingTypeEditDrawer({
  item,
  integrations,
  fetcher,
  isSubmitting,
  onClose,
  catalogEntity,
  catalogLoading,
  metaobjectDefinitionName,
}: {
  item: MeetingType | null;
  integrations: IntegrationConnections;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
  isSubmitting: boolean;
  onClose: () => void;
  catalogEntity?: CatalogEntityTranslationRow | null;
  catalogLoading?: boolean;
  metaobjectDefinitionName: string;
}) {
  const { t } = useAdminI18n();
  const isNew = item === null;
  const defaultVideoEnabled = item ? meetingTypeHasVideoLink(item) : false;
  const canEnableVideo = integrations.google || integrations.zoom;
  const formId = "meeting-type-edit-form";
  const unsyncedCount =
    catalogEntity?.localeRows.filter((row) => !row.synced && !row.primary).length ?? 0;

  return (
    <ServiceModalShell
      title={isNew ? t("meetingTypes.addTitle") : t("meetingTypes.editTitle")}
      subtitle={isNew ? t("meetingTypes.addSubtitle") : item?.name}
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
            disabled={isSubmitting}
          >
            {isSubmitting ? t("common.saving") : t("meetingTypes.saveMeetingType")}
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
        {!isNew && item && <input type="hidden" name="id" value={item.id} />}
        <input type="hidden" name="type" value="CUSTOM" />

        <div className="ab-services__modal-stack">
          <ServiceAccordion
            title={t("meetingTypes.sectionDetails")}
            description={t("meetingTypes.sectionDetailsHint")}
            defaultOpen
          >
            <div className="ab-services__form-grid">
              <div className="ab-services__form-field ab-services__form-field--highlight ab-services__form-field--full">
                <label className="ab-services__form-label" htmlFor="mt-name">
                  {t("meetingTypes.fieldName")}
                </label>
                <input
                  id="mt-name"
                  className="ab-services__input"
                  name="name"
                  defaultValue={item?.name ?? ""}
                  required
                />
              </div>

              <div className="ab-services__form-field ab-services__form-field--highlight">
                <label className="ab-services__form-label" htmlFor="mt-subtitle">
                  {t("meetingTypes.fieldSubtitle")}
                </label>
                <input
                  id="mt-subtitle"
                  className="ab-services__input"
                  name="subtitle"
                  placeholder={t("meetingTypes.subtitlePlaceholder")}
                  defaultValue={item?.subtitle ?? ""}
                />
              </div>

              <div className="ab-services__form-field ab-services__form-field--highlight ab-services__form-field--full">
                <label className="ab-services__form-label" htmlFor="mt-desc">
                  {t("meetingTypes.fieldDescription")}
                </label>
                <textarea
                  id="mt-desc"
                  className="ab-services__textarea"
                  name="description"
                  placeholder={t("meetingTypes.descriptionPlaceholder")}
                  defaultValue={item?.description ?? ""}
                />
              </div>

              <div className="ab-services__form-field--full">
                <ImageUploadField
                  key={item?.id ?? "new"}
                  defaultValue={item?.imageUrl}
                  label={t("meetingTypes.fieldImage")}
                />
              </div>

              <div className="ab-services__form-field ab-services__form-field--full">
                <span className="ab-services__form-label">{t("meetingTypes.fieldVideo")}</span>
                <div className="ab-services__detail-card">
                  <div className="ab-services__toggle-row">
                    <label
                      className={`ab-toggle${!canEnableVideo ? " ab-toggle--disabled" : ""}`}
                      htmlFor="mt-video"
                    >
                      <input
                        id="mt-video"
                        type="checkbox"
                        name={canEnableVideo ? "videoLinkEnabled" : undefined}
                        value="true"
                        defaultChecked={defaultVideoEnabled && canEnableVideo}
                        disabled={!canEnableVideo}
                      />
                      <span className="ab-toggle__slider" />
                    </label>
                    <div className="ab-services__toggle-text">
                      <p className="ab-services__toggle-title">{t("meetingTypes.enableVideoTitle")}</p>
                      <p className="ab-services__hint">
                        {canEnableVideo
                          ? t("meetingTypes.enableVideoHintConnected")
                          : t("meetingTypes.enableVideoHintDisconnected")}
                      </p>
                    </div>
                  </div>
                  <IntegrationStatusPanel integrations={integrations} />
                  {!canEnableVideo && (
                    <>
                      <p className="ab-services__hint ab-services__hint--spaced">
                        <Link to="/app" style={{ color: "#005bd3" }}>
                          {t("meetingTypes.goToDashboardBefore")}
                        </Link>{" "}
                        {t("meetingTypes.goToDashboardAfter")}
                      </p>
                      <input type="hidden" name="videoLinkEnabled" value="false" />
                    </>
                  )}
                </div>
              </div>

              <div className="ab-services__form-field ab-services__form-field--highlight ab-services__form-field--full">
                <span className="ab-services__form-label">{t("meetingTypes.fieldStatus")}</span>
                <label className="ab-services__checkbox-row ab-services__detail-card">
                  <input
                    type="checkbox"
                    name="active"
                    value="true"
                    defaultChecked={item?.active ?? true}
                  />
                  {t("meetingTypes.activeOnStorefront")}
                </label>
              </div>
            </div>
          </ServiceAccordion>

          {!isNew ? (
            <ServiceAccordion
              title={t("meetingTypes.sectionTranslations")}
              description={t("meetingTypes.sectionTranslationsHint")}
              badge={
                unsyncedCount > 0 ? (
                  <span>{unsyncedCount}</span>
                ) : undefined
              }
            >
              {catalogLoading ? (
                <p className="ab-services__hint">{t("meetingTypes.loadingTranslations")}</p>
              ) : (
                <CatalogEntityTranslations
                  entity={catalogEntity}
                  metaobjectDefinitionName={metaobjectDefinitionName}
                  embedded
                  translatableFieldLabels={[
                    t("meetingTypes.fieldName"),
                    t("meetingTypes.fieldSubtitle"),
                    t("meetingTypes.fieldDescription"),
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

export default function MeetingTypesPage() {
  const { meetingTypes, integrations, catalogTranslations } =
    useLoaderData<typeof loader>();
  const { t } = useAdminI18n();
  const fetcher = useFetcher<typeof action>();
  const catalogFetcher = useFetcher<typeof loader>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const isSubmitting = fetcher.state !== "idle";

  const typedItems = meetingTypes as MeetingType[];
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  const stats = useMemo(() => {
    const active = typedItems.filter((m) => m.active).length;
    return {
      total: typedItems.length,
      active,
      inactive: typedItems.length - active,
    };
  }, [typedItems]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "active") return typedItems.filter((m) => m.active);
    if (statusFilter === "inactive") return typedItems.filter((m) => !m.active);
    return typedItems;
  }, [typedItems, statusFilter]);

  const viewItem =
    viewId != null ? typedItems.find((m) => m.id === viewId) ?? null : null;
  const editItem =
    editId === "new"
      ? null
      : editId != null
        ? typedItems.find((m) => m.id === editId) ?? null
        : null;

  useFetcherIdleResult(fetcher, (data) => {
    if (typeof data !== "object" || data == null) return;
    if ("ok" in data && data.ok) {
      if ("action" in data && data.action === "deactivated") {
        showAppToast(
          shopify,
          t("meetingTypes.deactivateInstead", {
            count: "bookingCount" in data ? data.bookingCount : 0,
          }),
          { isError: true },
        );
      } else if ("action" in data && data.action === "deleted") {
        showAppToast(shopify, t("toast.meetingTypeDeleted"));
        setViewId(null);
        setEditId(null);
      } else {
        showAppToast(shopify, t("toast.meetingTypeSaved"));
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
      const message =
        typeof data.error === "string"
          ? data.error
          : t("toast.meetingTypeSaveFailed");
      showAppToast(shopify, message, { isError: true });
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
    if (editId && editId !== "new") {
      catalogFetcher.load(`/app/meeting-types?catalogEntityId=${editId}`);
    }
  }, [editId]);

  function openEdit(id: string | "new") {
    setViewId(null);
    setEditId(id);
  }

  return (
    <s-page heading={t("meetingTypes.pageTitle")}>
      <CatalogTranslationsBanner
        unsyncedLocaleLabels={catalogTranslations.unsyncedLocaleLabels}
        metaobjectDefinitionName={catalogTranslations.metaobjectDefinitionName}
        hasAnyUnsynced={catalogTranslations.hasAnyUnsynced}
      />
      <div className="ab-services">
        <div className="ab-services__stats">
          <div className="ab-services__stat">
            <div className="ab-services__stat-value">{stats.total}</div>
            <div className="ab-services__stat-label">{t("meetingTypes.statTotal")}</div>
          </div>
          <div className="ab-services__stat ab-services__stat--active">
            <div className="ab-services__stat-value">{stats.active}</div>
            <div className="ab-services__stat-label">{t("meetingTypes.statActive")}</div>
          </div>
          <div className="ab-services__stat ab-services__stat--inactive">
            <div className="ab-services__stat-value">{stats.inactive}</div>
            <div className="ab-services__stat-label">{t("meetingTypes.statInactive")}</div>
          </div>
        </div>

        <div className="ab-services__panel">
          <div className="ab-services__toolbar">
            <p className="ab-services__toolbar-title">{t("meetingTypes.toolbarTitle")}</p>
            <div className="ab-services__toolbar-actions">
              <div className="ab-services__field">
                <label className="ab-services__label" htmlFor="filter-status">
                  {t("common.status")}
                </label>
                <select
                  id="filter-status"
                  className="ab-services__select"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "" | "active" | "inactive")
                  }
                >
                  <option value="">{t("common.allStatuses")}</option>
                  <option value="active">{t("common.active")}</option>
                  <option value="inactive">{t("common.inactive")}</option>
                </select>
              </div>
              <button
                type="button"
                className="ab-services__btn-primary"
                onClick={() => openEdit("new")}
              >
                {t("meetingTypes.addMeetingType")}
              </button>
            </div>
          </div>

          <div className="ab-services__summary">
            {stats.total === 1
              ? t("meetingTypes.summaryShowing", {
                  count: filteredItems.length,
                  total: stats.total,
                })
              : t("meetingTypes.summaryShowingPlural", {
                  count: filteredItems.length,
                  total: stats.total,
                })}
            {" · "}
            {t("meetingTypes.summaryLinkBefore")}{" "}
            <Link to="/app/services" style={{ color: "#005bd3" }}>
              {t("nav.services")}
            </Link>{" "}
            {t("meetingTypes.summaryLinkAfter")}
          </div>

          {filteredItems.length === 0 ? (
            <div className="ab-services__empty">
              <div className="ab-services__empty-icon" aria-hidden>
                📹
              </div>
              <h3 className="ab-services__empty-title">
                {statusFilter ? t("meetingTypes.emptyFilteredTitle") : t("meetingTypes.emptyTitle")}
              </h3>
              <p className="ab-services__empty-text">
                {statusFilter
                  ? t("meetingTypes.emptyFilteredText")
                  : t("meetingTypes.emptyText")}
              </p>
              {!statusFilter && (
                <button
                  type="button"
                  className="ab-services__btn-primary"
                  onClick={() => openEdit("new")}
                >
                  {t("meetingTypes.addFirstMeetingType")}
                </button>
              )}
            </div>
          ) : (
            <table className="ab-services-table">
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("meetingTypes.tableSubtitle")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((mt) => (
                  <tr key={mt.id}>
                    <td>
                      <div className="ab-services__name">{mt.name}</div>
                      {mt.description && (
                        <div className="ab-services__meta">
                          {mt.description.length > 60
                            ? `${mt.description.slice(0, 60)}…`
                            : mt.description}
                        </div>
                      )}
                    </td>
                    <td>{meetingTypeSubtitle(mt, t)}</td>
                    <td>
                      <span
                        className={`ab-services__status ${mt.active ? "ab-services__status--active" : "ab-services__status--inactive"}`}
                      >
                        {mt.active ? t("common.active") : t("common.inactive")}
                      </span>
                    </td>
                    <td>
                      <div className="ab-services__actions">
                        <button
                          type="button"
                          className="ab-services__icon-btn ab-services__icon-btn--view"
                          aria-label={t("meetingTypes.viewMeetingType")}
                          title={t("common.viewDetails")}
                          onClick={() => {
                            setEditId(null);
                            setViewId(mt.id);
                          }}
                        >
                          <IconView />
                        </button>
                        <button
                          type="button"
                          className="ab-services__icon-btn ab-services__icon-btn--edit"
                          aria-label={t("meetingTypes.editMeetingType")}
                          title={t("common.edit")}
                          onClick={() => openEdit(mt.id)}
                        >
                          <IconEdit />
                        </button>
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={mt.id} />
                          <button
                            type="submit"
                            className="ab-services__icon-btn ab-services__icon-btn--delete"
                            aria-label={t("meetingTypes.deleteMeetingType")}
                            title={t("common.delete")}
                            disabled={isSubmitting}
                            onClick={(e) => {
                              if (
                                !confirm(
                                  t("meetingTypes.deleteConfirm", { name: mt.name }),
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

      {viewItem && (
        <MeetingTypeViewDrawer
          item={viewItem}
          onClose={() => setViewId(null)}
          onEdit={() => openEdit(viewItem.id)}
        />
      )}

      {editId != null && (
        <MeetingTypeEditDrawer
          key={editId}
          item={editItem}
          integrations={integrations}
          fetcher={fetcher}
          isSubmitting={isSubmitting}
          onClose={() => setEditId(null)}
          catalogEntity={
            editItem && catalogFetcher.data?.catalogEntity
              ? catalogFetcher.data.catalogEntity
              : undefined
          }
          catalogLoading={
            Boolean(editItem) && catalogFetcher.state !== "idle"
          }
          metaobjectDefinitionName={catalogTranslations.metaobjectDefinitionName}
        />
      )}
    </s-page>
  );
}

export const headers = boundary.headers;
