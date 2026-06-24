import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();

  const stagedRes = await admin.graphql(
    `#graphql
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: [
          {
            filename: file.name,
            mimeType: file.type || "image/jpeg",
            resource: "FILE",
            httpMethod: "POST",
          },
        ],
      },
    },
  );
  const stagedJson = await stagedRes.json();
  const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) {
    return Response.json({ error: "Staged upload failed" }, { status: 500 });
  }

  const uploadForm = new FormData();
  for (const param of target.parameters) {
    uploadForm.append(param.name, param.value);
  }
  uploadForm.append("file", new Blob([bytes], { type: file.type }), file.name);

  await fetch(target.url, { method: "POST", body: uploadForm });

  const fileRes = await admin.graphql(
    `#graphql
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          ... on MediaImage {
            id
            image { url }
          }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        files: [
          {
            alt: file.name,
            contentType: "IMAGE",
            originalSource: target.resourceUrl,
          },
        ],
      },
    },
  );
  const fileJson = await fileRes.json();
  const imageUrl = fileJson.data?.fileCreate?.files?.[0]?.image?.url;

  if (!imageUrl) {
    return Response.json({ error: "File create failed" }, { status: 500 });
  }

  return Response.json({ url: imageUrl });
};
