import { readFile, stat } from "fs/promises";
import { join } from "path";

const MIME: Record<string, string> = {
  ".js": "application/javascript",
  ".css": "text/css",
};

export async function serveWidgetAsset(fileName: string) {
  const allowed = ["booking-widget.js", "booking-widget.css"];
  if (!allowed.includes(fileName)) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = join(process.cwd(), "public", "booking-widget", fileName);
  try {
    const [content, fileStat] = await Promise.all([
      readFile(filePath),
      stat(filePath),
    ]);
    const ext = fileName.slice(fileName.lastIndexOf("."));
    return new Response(content, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=300",
        "X-Widget-Version": String(fileStat.mtimeMs),
      },
    });
  } catch {
    return new Response("Asset not built. Run: npm run build:widget", { status: 404 });
  }
}

export async function renderAdminWidgetPreview(
  shop: string,
  options: {
    theme: "classic" | "modern";
    primaryColor?: string;
    accentColor?: string;
  },
) {
  const settings = JSON.stringify({
    preview: true,
    theme: options.theme,
    primaryColor: options.primaryColor ?? "#0d2e26",
    accentColor: options.accentColor ?? "#f5f0e8",
    locale: "en",
    visible: true,
  }).replace(/</g, "\\u003c");

  let version = Date.now().toString();
  try {
    const jsPath = join(process.cwd(), "public", "booking-widget", "booking-widget.js");
    const fileStat = await stat(jsPath);
    version = String(fileStat.mtimeMs);
  } catch {
    /* fallback */
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/booking-widget/booking-widget.css?v=${version}" />
  <style>
    html, body { margin: 0; padding: 0; min-height: 0; height: auto; overflow: hidden; background: #fff; }
    body { padding: 12px; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="ab-booking-widget-root"
    class="ab-booking-widget"
    data-ab-booking-widget="true"
    data-shop="${shop.replace(/"/g, "&quot;")}"
    data-api-base="/apps/booking"
    data-settings='${settings}'></div>
  <script src="/booking-widget/booking-widget.js?v=${version}" defer></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

export async function renderWidgetPage(shop: string, settingsJson: string) {
  const settings = settingsJson.replace(/</g, "\\u003c");
  let version = Date.now().toString();
  try {
    const jsPath = join(process.cwd(), "public", "booking-widget", "booking-widget.js");
    const fileStat = await stat(jsPath);
    version = String(fileStat.mtimeMs);
  } catch {
    /* use timestamp fallback */
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/apps/booking/static/booking-widget.css?v=${version}" />
  <style>
    html, body { margin: 0; padding: 0; min-height: 0; height: auto; overflow: visible; background: #fff; }
    body { padding: 16px; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="ab-booking-widget-root"
    class="ab-booking-widget"
    data-ab-booking-widget="true"
    data-shop="${shop.replace(/"/g, "&quot;")}"
    data-api-base="/apps/booking"
    data-settings='${settings}'></div>
  <script src="/apps/booking/static/booking-widget.js?v=${version}" defer></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
