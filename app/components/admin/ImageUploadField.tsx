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
    <div className="ab-image-upload">
      <span className="ab-services__form-label">{label}</span>
      <input type="hidden" name={name} value={url} />

      <div className="ab-image-upload__panel">
        {url ? (
          <div className="ab-image-upload__preview">
            <img src={url} alt="" className="ab-image-upload__preview-img" />
            <button
              type="button"
              className="ab-image-upload__remove"
              onClick={clearImage}
              aria-label="Remove image"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M6 6l8 8M14 6l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ) : (
          <div className="ab-image-upload__empty">
            <span className="ab-image-upload__empty-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="9" cy="10" r="1.5" fill="currentColor" />
                <path d="M4 16l4.5-4.5 3 3L16 10l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="ab-image-upload__empty-text">No image selected</span>
            <span className="ab-image-upload__empty-hint">
              Choose from your library or upload a new image
            </span>
          </div>
        )}

        <div className="ab-image-upload__side">
          <div className="ab-image-upload__actions">
            <button
              type="button"
              className="ab-image-upload__btn ab-image-upload__btn--primary"
              onClick={pickFromShopifyLibrary}
              disabled={picking || uploading}
            >
              {picking ? "Opening library…" : "Select from library"}
            </button>
            <button
              type="button"
              className="ab-image-upload__btn"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload new"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              disabled={uploading}
              hidden
            />
          </div>

          <div className="ab-image-upload__url">
            <label className="ab-image-upload__url-label" htmlFor={`${name}-url`}>
              Or paste image URL
            </label>
            <input
              id={`${name}-url`}
              type="url"
              className="ab-services__input ab-image-upload__url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://cdn.shopify.com/..."
            />
          </div>
        </div>
      </div>

      <ImageLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={setUrl}
      />
    </div>
  );
}
