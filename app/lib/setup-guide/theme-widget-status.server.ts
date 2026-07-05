type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type ThemeWidgetStatus = {
  embedEnabled: boolean;
  blockOnTemplate: boolean;
  installed: boolean;
};

const THEME_FILES_QUERY = `#graphql
  query SetupGuideThemeFiles($filenames: [String!]!) {
    themes(roles: [MAIN], first: 1) {
      nodes {
        id
        files(filenames: $filenames, first: 50) {
          nodes {
            filename
            body {
              ... on OnlineStoreThemeFileBodyText {
                content
              }
            }
          }
        }
      }
    }
  }
`;

const TEMPLATE_FILENAMES = [
  "config/settings_data.json",
  "templates/index.json",
  "templates/product.json",
  "templates/collection.json",
  "templates/page.json",
  "templates/cart.json",
  "templates/blog.json",
  "templates/article.json",
  "templates/search.json",
];

const BOOKING_BLOCK_PATTERN = /\/blocks\/(booking-widget|booking-embed)(\/|$)/i;
const APP_HANDLE =
  process.env.SHOPIFY_APP_HANDLE?.trim() || "appointment-booking-26";

function isBookingWidgetBlockType(type: string) {
  const normalized = type.toLowerCase();
  if (BOOKING_BLOCK_PATTERN.test(normalized)) return true;
  if (normalized.includes(`/apps/${APP_HANDLE.toLowerCase()}/blocks/`)) {
    return true;
  }
  return false;
}

function isEnabledAppBlock(block: unknown) {
  if (!block || typeof block !== "object") return false;
  const record = block as Record<string, unknown>;
  const type = String(record.type ?? "");
  if (!isBookingWidgetBlockType(type)) return false;
  return record.disabled !== true;
}

function stripThemeJsonComments(raw: string) {
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function parseThemeJson(raw: string | undefined | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(stripThemeJsonComments(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function settingsEmbedEnabled(settings: Record<string, unknown> | null) {
  if (!settings) return false;
  const current = settings.current as Record<string, unknown> | undefined;
  const blocks = current?.blocks;
  if (!blocks || typeof blocks !== "object") return false;
  return Object.values(blocks as Record<string, unknown>).some(isEnabledAppBlock);
}

function templateHasAppBlock(template: Record<string, unknown> | null) {
  if (!template) return false;
  const sections = template.sections;
  if (!sections || typeof sections !== "object") return false;

  for (const section of Object.values(sections as Record<string, unknown>)) {
    if (!section || typeof section !== "object") continue;
    const blocks = (section as Record<string, unknown>).blocks;
    if (!blocks || typeof blocks !== "object") continue;
    if (Object.values(blocks as Record<string, unknown>).some(isEnabledAppBlock)) {
      return true;
    }
  }

  return false;
}

export async function detectBookingWidgetOnTheme(
  admin: AdminClient | null | undefined,
): Promise<ThemeWidgetStatus> {
  const empty = { embedEnabled: false, blockOnTemplate: false, installed: false };
  if (!admin?.graphql) return empty;

  try {
    const response = await admin.graphql(THEME_FILES_QUERY, {
      variables: { filenames: TEMPLATE_FILENAMES },
    });
    const payload = (await response.json()) as {
      data?: {
        themes?: {
          nodes?: Array<{
            files?: {
              nodes?: Array<{
                filename?: string;
                body?: { content?: string };
              }>;
            };
          }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      console.warn("[setup-guide] theme query:", payload.errors[0]?.message);
      return empty;
    }

    const files = payload.data?.themes?.nodes?.[0]?.files?.nodes ?? [];
    let embedEnabled = false;
    let blockOnTemplate = false;

    for (const file of files) {
      const filename = file.filename ?? "";
      const json = parseThemeJson(file.body?.content);
      if (!json) continue;

      if (filename === "config/settings_data.json") {
        embedEnabled = settingsEmbedEnabled(json);
      } else if (filename.startsWith("templates/")) {
        blockOnTemplate = blockOnTemplate || templateHasAppBlock(json);
      }
    }

    return {
      embedEnabled,
      blockOnTemplate,
      installed: embedEnabled || blockOnTemplate,
    };
  } catch (error) {
    console.warn("[setup-guide] theme widget detection:", error);
    return empty;
  }
}
