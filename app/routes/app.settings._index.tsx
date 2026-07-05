import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const suffix = url.search ? url.search : "";
  return redirect(`/app/settings/languages${suffix}`);
};
