import { useRef, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { showAppToast } from "../../lib/admin/toast";
import { ImageLibraryModal } from "./ImageLibraryModal";

type Props = {
  name?: string;
  defaultValue?: string | null;
  label?: string;
};

async function resolveFileUrls(ids: string[]) {
  const res = await fetch("/api/files/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const data = await res.json();
  return (data.files ?? []) as Array<{ id: string; url: string }>;
}

export function ImageUploadField({
  name = "imageUrl",
  defaultValue = "",
  label = "Image",
}: Props) {
  const shopify = useAppBridge();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/image", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setUrl(data.url);
      else showAppToast(shopify, data.error ?? "Upload failed", { isError: true });
    } finally {
      setUploading(false);
    }
  }

  async function pickFromShopifyLibrary() {
    setPicking(true);
    try {
      if (shopify.intents?.invoke) {
        const activity = await shopify.intents.invoke("pick:shopify/File", {
          data: { mediaTypes: ["MediaImage"], multiSelect: false },
        });
        const response = await activity.complete;

        if (response?.code === "ok" && response.data?.ids) {
          const ids = response.data.ids as string[];
          const files = await resolveFileUrls(ids);
          if (files[0]?.url) {
            setUrl(files[0].url);
            return;
          }
        }

        if (response?.code === "closed") return;

        if (response?.code === "error") {
          showAppToast(shopify, response.message ?? "Could not open file picker", {
            isError: true,
          });
        }
      }

      setLibraryOpen(true);
    } catch {
      setLibraryOpen(true);
    } finally {
      setPicking(false);
    }
  }

  function clearImage() {
    setUrl("");
  }

  return (
    <div className="ab-services__form-field">
      <span className="ab-services__form-label">{label}</span>
      <input type="hidden" name={name} value={url} />

      {url ? (
        <div style={{ marginTop: 4 }}>
          <img
            src={url}
            alt=""
            className="ab-services__detail-image"
            style={{ maxHeight: 120, marginBottom: 8 }}
          />
          <button
            type="button"
            className="ab-services__drawer-btn"
            onClick={clearImage}
          >
            Remove image
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="ab-services__drawer-btn"
          onClick={pickFromShopifyLibrary}
          disabled={picking || uploading}
        >
          {picking ? "Opening library…" : "Select from library"}
        </button>
        <button
          type="button"
          className="ab-services__drawer-btn"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload new
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          disabled={uploading}
          style={{ display: "none" }}
        />
      </div>

      {uploading && <p className="ab-services__hint">Uploading…</p>}

      <label className="ab-services__form-field" style={{ marginTop: 8 }}>
        <span className="ab-services__form-label">Or paste image URL</span>
        <input
          type="url"
          className="ab-services__input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
        />
      </label>

      <ImageLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={setUrl}
      />
    </div>
  );
}
