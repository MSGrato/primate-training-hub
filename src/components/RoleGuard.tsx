import { Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "@/contexts/AuthContext";

type AppRole = "employee" | "supervisor" | "coordinator";

interface RoleGuardProps {
  allow: AppRole[];
  children: ReactElement;
}

export default function RoleGuard({ allow, children }: RoleGuardProps) {
  const { session, role, loading } = useAuth();

  if (loading || (session && role === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allow.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
