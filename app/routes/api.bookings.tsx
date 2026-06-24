import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAdminMerchant, requirePublicMerchant } from "../lib/auth.server";
import {
  BookingError,
  createBooking,
  runBookingIntegrations,
  serializePublicBooking,
  listBookings,
  cancelBooking,
  deleteBooking,
  getBooking,
} from "../models/booking.server";
import {
  bookingCreateSchema,
  bookingListQuerySchema,
  parseJsonBody,
  parseQuery,
} from "../lib/validation/schemas";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { merchant } = await requireAdminMerchant(request);
  const parsed = parseQuery(
    bookingListQuerySchema,
    new URL(request.url).searchParams,
  );

  if (!parsed.success) {
    return Response.json({ error: parsed.errors }, { status: 400 });
  }

  const result = await listBookings(merchant.id, parsed.data);
  return Response.json(result);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "POST") {
    return handleCreate(request);
  }

  if (request.method === "PATCH") {
    return handleCancel(request);
  }

  if (request.method === "DELETE") {
    return handleDelete(request);
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};

async function handleCreate(request: Request) {
  const body = await request.json();
  const parsed = parseJsonBody(bookingCreateSchema, body);

  if (!parsed.success) {
    return Response.json({ error: parsed.errors }, { status: 400 });
  }

  const { merchant } = await requirePublicMerchant(request);

  if (parsed.data.shop !== merchant.shop) {
    return Response.json({ error: "Shop mismatch" }, { status: 403 });
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

    return Response.json({ booking: serializePublicBooking(booking) });
  } catch (error) {
    if (error instanceof BookingError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }
    console.error("[api] booking create failed", error);
    return Response.json({ error: "Booking failed" }, { status: 500 });
  }
}

async function handleCancel(request: Request) {
  const { merchant } = await requireAdminMerchant(request);
  const body = await request.json();
  const bookingId = body?.bookingId as string | undefined;

  if (!bookingId) {
    return Response.json({ error: "bookingId required" }, { status: 400 });
  }

  const existing = await getBooking(merchant.id, bookingId);
  if (!existing) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  const booking = await cancelBooking(merchant.id, bookingId);
  return Response.json({ booking });
}

async function handleDelete(request: Request) {
  const { merchant } = await requireAdminMerchant(request);
  const body = await request.json();
  const bookingId = body?.bookingId as string | undefined;

  if (!bookingId) {
    return Response.json({ error: "bookingId required" }, { status: 400 });
  }

  const existing = await getBooking(merchant.id, bookingId);
  if (!existing) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  await deleteBooking(merchant.id, bookingId);
  return Response.json({ ok: true });
}
