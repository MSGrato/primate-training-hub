import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function DashboardLayout() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === "/dashboard/home" || location.pathname === "/dashboard";
  const requiresPasswordReset = session?.user.user_metadata?.force_password_reset === true;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>);

  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requiresPasswordReset) {
    return <Navigate to="/reset-password" replace />;
  }

  return (
    <SidebarProvider defaultOpen={!isHome} open={isHome ? false : undefined}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center border-b bg-card px-3 sm:px-4">
            <SidebarTrigger />
          </header>
          <div className="flex-1 p-3 sm:p-4 lg:p-6 bg-primary text-primary-foreground">
            <div className="mx-auto w-full max-w-screen-2xl min-w-0">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>);

}