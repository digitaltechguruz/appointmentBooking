import { useCallback, useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

type LibraryFile = {
  id: string;
  url: string;
  alt: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
};

export function ImageLibraryModal({ open, onClose, onSelect }: Props) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadFiles = useCallback(async (after?: string | null) => {
    setLoading(true);
    try {
      const params = after ? `?cursor=${encodeURIComponent(after)}` : "";
      const res = await fetch(`/api/files${params}`);
      const data = await res.json();
      const next = (data.files ?? []) as LibraryFile[];
      setFiles((prev) => (after ? [...prev, ...next] : next));
      setHasMore(Boolean(data.pageInfo?.hasNextPage));
      setCursor(data.pageInfo?.endCursor ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setFiles([]);
      setCursor(null);
      loadFiles();
    }
  }, [open, loadFiles]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "min(720px, 100%)",
          maxHeight: "80vh",
          overflow: "auto",
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <s-text>Select image from library</s-text>
          <s-button variant="tertiary" onClick={onClose}>
            Close
          </s-button>
        </div>

        {loading && files.length === 0 ? (
          <s-text>Loading images…</s-text>
        ) : files.length === 0 ? (
          <s-text>No images found. Upload files in Shopify Admin → Content → Files.</s-text>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 12,
            }}
          >
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => {
                  onSelect(file.url);
                  onClose();
                }}
                style={{
                  border: "1px solid #e3e3e3",
                  borderRadius: 8,
                  padding: 4,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <img
                  src={file.url}
                  alt={file.alt ?? ""}
                  style={{
                    width: "100%",
                    height: 100,
                    objectFit: "cover",
                    borderRadius: 4,
                    display: "block",
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {hasMore && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <s-button
              variant="secondary"
              onClick={() => loadFiles(cursor)}
              disabled={loading}
            >
              {loading ? "Loading…" : "Load more"}
            </s-button>
          </div>
        )}
      </div>
    </div>
  );
}
