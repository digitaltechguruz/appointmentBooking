import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requirePublicMerchant } from "../lib/auth.server";
import { listServices } from "../models/service.server";
import { listMeetingTypesForService, listStorefrontMeetingTypesForService } from "../models/meeting-type.server";
import {
  getAvailableSlots,
  getMonthAvailability,
  createBooking,
  runBookingIntegrations,
  serializePublicBooking,
  BookingError,
} from "../models/booking.server";
import { getMerchantTimezone } from "../models/merchant.server";
import { getStorefrontConfig } from "../models/availability.server";
import {
  renderWidgetPage,
  serveWidgetAsset,
} from "../lib/booking/widget-page.server";
import { resolveCatalogTextForStorefront } from "../lib/widget/catalog-i18n-metaobject.server.js";
import {
  bookingCreateSchema,
  parseJsonBody,
} from "../lib/validation/schemas";
import type { MeetingType, Service, ServiceMeetingType } from "@prisma/client";

type ServiceRow = Service & {
  meetingTypes: (ServiceMeetingType & { meetingType: MeetingType })[];
};

function jsonOk(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function handlePath(request: Request, fullPath: string) {
  const url = new URL(request.url);

  if (fullPath.startsWith("static/")) {
    return serveWidgetAsset(fullPath.replace("static/", ""));
  }

  if (fullPath === "widget") {
    const shop = url.searchParams.get("shop") ?? "";
    if (!shop) {
      return jsonError("Missing shop parameter", 400);
    }
    const settings = url.searchParams.get("settings") ?? "{}";
    return await renderWidgetPage(shop, settings);
  }

  const { merchant, shop, admin } = await requirePublicMerchant(request);
  const segment = fullPath.split("/")[0];

  switch (segment) {
    case "services": {
      const locale = url.searchParams.get("locale") ?? "en";
      const services = await listServices(merchant.id, true);
      const catalogContext = {
        definitionCache: new Map<string, unknown>(),
        primaryLocaleCode: undefined as string | undefined,
      };
      const localizedServices = (
        await Promise.all(
          (services as ServiceRow[]).map(async (s) => {
            if (!s.durationMinutes || s.durationMinutes < 1) {
              return null;
            }
            const fallback = {
              name: s.name,
              description: s.description ?? "",
            };
            const text = (admin
              ? await resolveCatalogTextForStorefront(
                  admin,
                  "service",
                  s.id,
                  locale,
                  shop,
                  fallback,
                  catalogContext,
                )
              : fallback) as {
              name?: string;
              description?: string;
            };
            return {
              id: s.id,
              name: text.name || s.name,
              description: text.description || s.description,
              imageUrl: s.imageUrl,
              durationMinutes: s.durationMinutes,
              meetingTypeIds: s.meetingTypes.map((mt) => mt.meetingTypeId),
            };
          }),
        )
      ).filter((row): row is NonNullable<typeof row> => row !== null);
      return Response.json({ services: localizedServices });
    }
    case "meeting-types": {
      const serviceId = url.searchParams.get("serviceId");
      if (!serviceId) {
        return Response.json({ error: "serviceId required" }, { status: 400 });
      }
      const locale = url.searchParams.get("locale") ?? "en";
      const meetingTypes = await listStorefrontMeetingTypesForService(
        merchant.id,
        serviceId,
      );
      const catalogContext = {
        definitionCache: new Map<string, unknown>(),
        primaryLocaleCode: undefined as string | undefined,
      };
      const localizedMeetingTypes = await Promise.all(
        meetingTypes.map(async (mt: MeetingType) => {
          const fallback = {
            name: mt.name,
            subtitle: mt.subtitle ?? "",
            description: mt.description ?? "",
          };
          const text = (admin
            ? await resolveCatalogTextForStorefront(
                admin,
                "meetingType",
                mt.id,
                locale,
                shop,
                fallback,
                catalogContext,
              )
            : fallback) as {
            name?: string;
            subtitle?: string;
            description?: string;
          };
          return {
            id: mt.id,
            name: text.name || mt.name,
            subtitle: text.subtitle || mt.subtitle,
            description: text.description || mt.description,
            type: mt.type,
            imageUrl: mt.imageUrl,
          };
        }),
      );
      return Response.json({ meetingTypes: localizedMeetingTypes });
    }
    case "config": {
      const locale = url.searchParams.get("locale") ?? "en";
      const serviceId = url.searchParams.get("serviceId") ?? undefined;
      const config = await getStorefrontConfig(
        merchant.id,
        shop,
        locale,
        admin,
        serviceId,
      );
      return Response.json(config);
    }
    case "availability": {
      const serviceId = url.searchParams.get("serviceId");
      if (!serviceId) {
        return Response.json({ error: "serviceId required" }, { status: 400 });
      }
      const date = url.searchParams.get("date");
      const month = url.searchParams.get("month");
      if (date) {
        const [slots, timezone] = await Promise.all([
          getAvailableSlots(merchant.id, serviceId, date),
          getMerchantTimezone(merchant.id),
        ]);
        return Response.json({ date, slots, timezone });
      }
      if (month) {
        const locale = url.searchParams.get("locale") ?? "en";
        const [availability, timezone] = await Promise.all([
          getMonthAvailability(merchant.id, serviceId, month),
          getMerchantTimezone(merchant.id),
        ]);

        let workingHoursSummary: string | undefined;
        let calendarBounds: Awaited<
          ReturnType<typeof getStorefrontConfig>
        >["calendarBounds"];
        try {
          const config = await getStorefrontConfig(
            merchant.id,
            shop,
            locale,
            admin,
            serviceId,
          );
          workingHoursSummary = config.workingHoursSummary;
          calendarBounds = config.calendarBounds;
        } catch (configError) {
          console.warn("[proxy] availability config:", configError);
        }

        return Response.json({
          ...availability,
          workingHoursSummary,
          calendarBounds,
          timezone,
        });
      }
      return Response.json({ error: "date or month required" }, { status: 400 });
    }
    case "translations": {
      const locale = url.searchParams.get("locale") ?? "en";
      const { getStorefrontWidgetTranslations } = await import(
        "../lib/widget/storefront-translations.server"
      );
      const payload = await getStorefrontWidgetTranslations(shop, locale, admin);
      return Response.json(payload);
    }
    case "bookings": {
      if (request.method === "POST") {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError("Invalid request body", 400);
        }

        const parsed = parseJsonBody(bookingCreateSchema, body);
        if (!parsed.success) {
          return jsonError("Invalid booking details", 400);
        }

        if (parsed.data.shop !== merchant.shop) {
          return jsonError("Shop mismatch", 403);
        }

        try {
          const booking = await createBooking(
            merchant.id,
            {
              serviceId: parsed.data.serviceId,
              meetingTypeId: parsed.data.meetingTypeId,
              date: parsed.data.date,
              startTime: parsed.data.startTime,
              customer: parsed.data.customer,
            },
            { deferIntegrations: true },
          );
          void runBookingIntegrations(merchant.id, booking.id);
          return jsonOk({ booking: serializePublicBooking(booking) });
        } catch (error) {
          if (error instanceof BookingError) {
            return jsonError(error.message, 422, { code: error.code });
          }
          console.error("[proxy] booking create failed", error);
          return jsonError("Booking failed", 500);
        }
      }
      return jsonError("Method not allowed", 405);
    }
    default:
      return Response.json({ error: "Not found" }, { status: 404 });
  }
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const fullPath = params["*"] ?? "";
  try {
    return await handlePath(request, fullPath);
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("[proxy] loader error", error);
    return Response.json({ error: "Request failed" }, { status: 500 });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const fullPath = params["*"] ?? "";
  try {
    return await handlePath(request, fullPath);
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("[proxy] action error", error);
    return Response.json({ error: "Request failed" }, { status: 500 });
  }
};
