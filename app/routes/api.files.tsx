import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

type FileNode = {
  id: string;
  url: string;
  alt: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const res = await admin.graphql(
    `#graphql
    query ListImageFiles($first: Int!, $after: String) {
      files(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            ... on MediaImage {
              id
              alt
              image {
                url
              }
              preview {
                image {
                  url
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`,
    { variables: { first: 30, after: cursor } },
  );

  const json = await res.json();
  const connection = json.data?.files;

  const files: FileNode[] = (connection?.edges ?? [])
    .map((edge: { node: Record<string, unknown> }) => edge.node)
    .filter((node: Record<string, unknown>) => node.id && node.image)
    .map((node: { id: string; alt?: string; image?: { url: string }; preview?: { image?: { url: string } } }) => ({
      id: node.id,
      url: node.image?.url ?? node.preview?.image?.url ?? "",
      alt: node.alt ?? null,
    }))
    .filter((file: FileNode) => file.url);

  return Response.json({
    files,
    pageInfo: connection?.pageInfo ?? { hasNextPage: false, endCursor: null },
  });
};
