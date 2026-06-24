import { useEffect, useRef } from "react";

const DEFAULT_TOAST_DURATION_MS = 2000;

type ToastApi = {
  show: (
    message: string,
    opts?: { duration?: number; isError?: boolean },
  ) => string;
  hide: (id: string) => void;
};

export function showAppToast(
  shopify: { toast: ToastApi },
  message: string,
  opts?: { isError?: boolean; duration?: number },
) {
  const duration = opts?.duration ?? DEFAULT_TOAST_DURATION_MS;
  const id = shopify.toast.show(message, {
    duration,
    isError: opts?.isError,
  });
  window.setTimeout(() => shopify.toast.hide(id), duration);
}

type FetcherLike = {
  state: "idle" | "submitting" | "loading";
  data: unknown;
};

/** Run a handler once when a fetcher finishes submitting (avoids repeat toasts on revalidate). */
export function useFetcherIdleResult(
  fetcher: FetcherLike,
  onIdle: (data: unknown) => void,
) {
  const prevStateRef = useRef(fetcher.state);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = fetcher.state;

    if (
      prevState !== "idle" &&
      fetcher.state === "idle" &&
      fetcher.data != null
    ) {
      onIdleRef.current(fetcher.data);
    }
  }, [fetcher.state, fetcher.data]);
}
