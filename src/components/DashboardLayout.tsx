import { Navigate, Outlet, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { PrimateLogo } from "@/components/PrimateLogo";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function DashboardLayout() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const requiresPasswordReset = session?.user.user_metadata?.force_password_reset === true;
  const isHomePage = location.pathname === "/dashboard/home";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requiresPasswordReset) {
    return <Navigate to="/reset-password" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {!isHomePage && <AppSidebar />}
        <main className="flex min-w-0 flex-1 flex-col">
          {!isHomePage && (
            <header className="flex h-14 items-center gap-2 border-b bg-card px-3 sm:px-4">
              <SidebarTrigger />
              <Link to="/dashboard/home" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <PrimateLogo className="h-5 w-5 text-secondary" />
                <span className="text-sm font-medium">Home</span>
              </Link>
            </header>
          )}
          <div className="flex-1 p-3 sm:p-4 lg:p-6">
            <div className="mx-auto w-full max-w-screen-2xl min-w-0">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
