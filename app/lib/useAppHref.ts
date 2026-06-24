import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

export function cleanEmbeddedSearch(search: string) {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function useAppTo(path: string) {
  const { search } = useLocation();
  return { pathname: path, search: cleanEmbeddedSearch(search) };
}

export function useAppHref(path: string) {
  const { pathname, search } = useAppTo(path);
  return `${pathname}${search}`;
}

export function useEmbeddedUrlCleanup() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const hadEmbedded = params.has("shop") || params.has("host");
    if (!hadEmbedded) return;
    // Keep shop/host params; nothing to strip for this app.
  }, []);
}

export function useAppNavigate() {
  const navigate = useNavigate();
  const { search } = useLocation();

  return useCallback(
    (path: string) => {
      navigate({
        pathname: path,
        search: cleanEmbeddedSearch(search),
      });
    },
    [navigate, search],
  );
}
