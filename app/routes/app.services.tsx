import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { requireAdminMerchant } from "../lib/auth.server";
import {
  listServices,
  createService,
  updateService,
  deleteService,
  getService,
} from "../models/service.server";
import { listMeetingTypes } from "../models/meeting-type.server";
import { parseJsonBody, serviceCreateSchema } from "../lib/validation/schemas";
import type { MeetingType } from "@prisma/client";
import type { ServiceWithMeetingTypes } from "../types/admin";
import { ImageUploadField } from "../components/admin/ImageUploadField";
import { CatalogTranslationsBanner } from "../components/admin/CatalogTranslationsBanner";
import { CatalogEntityTranslations } from "../components/admin/CatalogEntityTranslations";
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
import "../components/admin/services.css";

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
  return { services, meetingTypes, catalogTranslations };
};

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
    durationMinutes: formData.get("durationMinutes"),
    active: formData.get("active") === "true",
    meetingTypeIds: formData.getAll("meetingTypeIds") as string[],
  };

  const parsed = parseJsonBody(serviceCreateSchema, body);
  if (!parsed.success) {
    return { error: parsed.errors };
  }

  const id = formData.get("id") as string | null;
  let savedId: string;
  if (intent === "update" && id) {
    await updateService(merchant.id, id, parsed.data);
    savedId = id;
  } else {
    const created = await createService(merchant.id, parsed.data);
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

function ServiceViewDrawer({
  service,
  onClose,
  onEdit,
}: {
  service: ServiceWithMeetingTypes;
  onClose: () => void;
  onEdit: () => void;
}) {
  const meetingTypeNames = service.meetingTypes.map((mt) => mt.meetingType.name);

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
          <h2 className="ab-services__drawer-title">{service.name}</h2>
          <button
            type="button"
            className="ab-services__icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>

        <div className="ab-services__drawer-body">
          {service.imageUrl && (
            <div className="ab-services__detail-section">
              <img
                src={service.imageUrl}
                alt=""
                className="ab-services__detail-image"
              />
            </div>
          )}

          <div className="ab-services__detail-section">
            <h3 className="ab-services__detail-heading">Details</h3>
            <div className="ab-services__detail-grid">
              <DetailRow label="Name" value={service.name} />
              <DetailRow label="Description" value={service.description} />
              <DetailRow label="Duration" value={`${service.durationMinutes} min`} />
              <DetailRow
                label="Status"
                value={
                  <span
                    className={`ab-services__status ${service.active ? "ab-services__status--active" : "ab-services__status--inactive"}`}
                  >
                    {service.active ? "Active" : "Inactive"}
                  </span>
                }
              />
            </div>
          </div>

          <div className="ab-services__detail-section">
            <h3 className="ab-services__detail-heading">Meeting types</h3>
            {meetingTypeNames.length === 0 ? (
              <p className="ab-services__hint">No meeting types linked</p>
            ) : (
              <div className="ab-services__chip-list">
                {meetingTypeNames.map((name) => (
                  <span key={name} className="ab-services__chip">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ab-services__drawer-footer">
          <button
            type="button"
            className="ab-services__drawer-btn ab-services__drawer-btn--secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="ab-services__drawer-btn ab-services__drawer-btn--primary"
            onClick={onEdit}
          >
            Edit service
          </button>
        </div>
      </div>
    </div>
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
  const isNew = service === null;
  const selectedIds =
    service?.meetingTypes.map((mt) => mt.meetingTypeId) ?? [];

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
          <h2 className="ab-services__drawer-title">
            {isNew ? "Add service" : "Edit service"}
          </h2>
          <button
            type="button"
            className="ab-services__icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>

        <fetcher.Form method="post" className="ab-services__drawer-form">
          <input
            type="hidden"
            name="intent"
            value={isNew ? "create" : "update"}
          />
          {!isNew && service && <input type="hidden" name="id" value={service.id} />}

          <div className="ab-services__drawer-body">
            <div className="ab-services__form">
            <div className="ab-services__form-field">
              <label className="ab-services__form-label" htmlFor="service-name">
                Name
              </label>
              <input
                id="service-name"
                className="ab-services__input"
                name="name"
                defaultValue={service?.name ?? ""}
                required
              />
            </div>

            <div className="ab-services__form-field">
              <label className="ab-services__form-label" htmlFor="service-desc">
                Description
              </label>
              <textarea
                id="service-desc"
                className="ab-services__textarea"
                name="description"
                defaultValue={service?.description ?? ""}
              />
            </div>

            <ImageUploadField
              key={service?.id ?? "new"}
              defaultValue={service?.imageUrl}
              label="Service image"
            />

            <div className="ab-services__form-field">
              <label className="ab-services__form-label" htmlFor="service-duration">
                Duration (minutes)
              </label>
              <input
                id="service-duration"
                className="ab-services__input"
                name="durationMinutes"
                type="number"
                min={5}
                max={480}
                defaultValue={String(service?.durationMinutes ?? 30)}
                required
              />
            </div>

            <label className="ab-services__checkbox-row">
              <input
                type="checkbox"
                name="active"
                value="true"
                defaultChecked={service?.active ?? true}
              />
              Active on storefront
            </label>

            <div className="ab-services__form-field">
              <span className="ab-services__form-label">Meeting types</span>
              <p className="ab-services__hint">
                Choose which meeting options customers can pick for this service.
              </p>
              <div className="ab-services__checkbox-group">
                {meetingTypes.length === 0 ? (
                  <p className="ab-services__hint">No meeting types yet — create them first.</p>
                ) : (
                  meetingTypes.map((mt) => (
                    <label key={mt.id} className="ab-services__checkbox-row">
                      <input
                        type="checkbox"
                        name="meetingTypeIds"
                        value={mt.id}
                        defaultChecked={selectedIds.includes(mt.id)}
                      />
                      {mt.name}
                    </label>
                  ))
                )}
              </div>
            </div>
            </div>

            {!isNew ? (
              catalogLoading ? (
                <p className="ab-services__hint">Loading translations…</p>
              ) : (
                <CatalogEntityTranslations
                  entity={catalogEntity}
                  metaobjectDefinitionName={metaobjectDefinitionName}
                />
              )
            ) : null}
          </div>

          <div className="ab-services__drawer-footer">
            <button
              type="button"
              className="ab-services__drawer-btn ab-services__drawer-btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ab-services__drawer-btn ab-services__drawer-btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save service"}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const { services, meetingTypes, catalogTranslations } =
    useLoaderData<typeof loader>();
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
    if (editId && editId !== "new") {
      catalogFetcher.load(`/app/services?catalogEntityId=${editId}`);
    }
  }, [editId]);

  function openEdit(id: string | "new") {
    setViewId(null);
    setEditId(id);
  }

  return (
    <s-page heading="Services">
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
