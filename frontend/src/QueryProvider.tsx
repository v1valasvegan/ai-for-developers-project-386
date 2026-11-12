import { useState, type ReactNode } from "react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";

// One shared listener also handles returning to a different browser window,
// not only switching tabs. Query owns refetching and visibility-aware polling.
focusManager.setEventListener((notify) => {
  if (typeof window === "undefined") return;
  const onFocus = () => notify();
  document.addEventListener("visibilitychange", onFocus);
  window.addEventListener("focus", onFocus);
  return () => {
    document.removeEventListener("visibilitychange", onFocus);
    window.removeEventListener("focus", onFocus);
  };
});

export default function QueryProvider({ children }: { children: ReactNode }) {
  // Each app mount (and each test/SSR render) owns an isolated in-memory cache.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 0,
            refetchOnWindowFocus: true,
            // Preserve an explicit visible error/retry even when the browser is offline.
            networkMode: "always",
            refetchOnReconnect: true,
          },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
