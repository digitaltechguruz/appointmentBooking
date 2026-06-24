import { redirect } from "react-router";
import { authenticate } from "../../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const appPath = query ? `/app?${query}` : "/app";

  // Embedded admin always opens the app, not the public landing page.
  if (
    url.searchParams.get("shop") ||
    url.searchParams.get("host") ||
    url.searchParams.get("embedded")
  ) {
    throw redirect(appPath);
  }

  try {
    await authenticate.admin(request);
    throw redirect(appPath);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
  }

  throw redirect("/auth/login");
};

export default function App() {
  return null;
}
