import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids : [];

  if (ids.length === 0) {
    return Response.json({ error: "No file ids provided" }, { status: 400 });
  }

  const res = await admin.graphql(
    `#graphql
    query ResolveFiles($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on MediaImage {
          id
          image {
            url
          }
        }
        ... on GenericFile {
          id
          url
        }
      }
    }`,
    { variables: { ids } },
  );

  const json = await res.json();
  const nodes = json.data?.nodes ?? [];

  const files = nodes
    .filter(Boolean)
    .map((node: { id: string; image?: { url: string }; url?: string }) => ({
      id: node.id,
      url: node.image?.url ?? node.url ?? "",
    }))
    .filter((file: { url: string }) => file.url);

  return Response.json({ files });
};
