import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // The `_authenticated` subtree is client-only (`ssr: false`). During
    // hydration the router schedules a forced "minimum pending" timer for the
    // first non-SSR match and then updates that match from a setTimeout, which
    // can land before React has mounted the router Transitioner. Disabling the
    // minimum-pending window removes that stray post-hydration update.
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });

  return router;
};
