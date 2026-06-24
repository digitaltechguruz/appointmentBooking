import type { ActionFunctionArgs } from "react-router";
import { requireAdminMerchant } from "../lib/auth.server";
import { getZoomAuthUrl } from "../lib/integrations/zoom/meetings.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { merchant, session } = await requireAdminMerchant(request);
    const url = getZoomAuthUrl(merchant.id, session.shop);
    return Response.json({ ok: true, url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start Zoom connection";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
};
