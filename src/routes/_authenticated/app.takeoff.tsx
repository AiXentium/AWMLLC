import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout route for the Takeoff Control Center. Children render their own AppShell. */
export const Route = createFileRoute("/_authenticated/app/takeoff")({
  component: () => <Outlet />,
});
