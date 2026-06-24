import type { LoaderFunctionArgs } from "react-router";
import { serveWidgetAsset } from "../lib/booking/widget-page.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const file = params.file;
  if (!file) {
    return new Response("Not found", { status: 404 });
  }
  return serveWidgetAsset(file);
};
