import { createRootRoute, Outlet } from '@tanstack/react-router';
import { SiteHeader } from '@/components/layout/site-header';
export const Route = createRootRoute({
  component: RootLayout,
});
function RootLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
    </>
  );
}
