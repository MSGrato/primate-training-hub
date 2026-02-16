import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DashboardLayout from "./components/DashboardLayout";
import RoleGuard from "./components/RoleGuard";
import TrainingList from "./pages/dashboard/TrainingList";
import InProgress from "./pages/dashboard/InProgress";
import TrainingReport from "./pages/dashboard/TrainingReport";
import Profile from "./pages/dashboard/Profile";
import EmployeeReports from "./pages/dashboard/EmployeeReports";
import ApprovalQueue from "./pages/dashboard/ApprovalQueue";
import ManageTrainings from "./pages/dashboard/ManageTrainings";
import JobTags from "./pages/dashboard/JobTags";
import JobTitles from "./pages/dashboard/JobTitles";
import UserManagement from "./pages/dashboard/UserManagement";
import TrainingDetail from "./pages/dashboard/TrainingDetail";
import History from "./pages/dashboard/History";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<TrainingList />} />
              <Route path="in-progress" element={<InProgress />} />
              <Route path="report" element={<TrainingReport />} />
              <Route path="profile" element={<Profile />} />
              <Route
                path="employee-reports"
                element={
                  <RoleGuard allow={["supervisor", "coordinator"]}>
                    <EmployeeReports />
                  </RoleGuard>
                }
              />
              <Route
                path="approvals"
                element={
                  <RoleGuard allow={["supervisor", "coordinator"]}>
                    <ApprovalQueue />
                  </RoleGuard>
                }
              />
              <Route
                path="manage-trainings"
                element={
                  <RoleGuard allow={["coordinator"]}>
                    <ManageTrainings />
                  </RoleGuard>
                }
              />
              <Route
                path="job-tags"
                element={
                  <RoleGuard allow={["coordinator"]}>
                    <JobTags />
                  </RoleGuard>
                }
              />
              <Route
                path="job-titles"
                element={
                  <RoleGuard allow={["coordinator"]}>
                    <JobTitles />
                  </RoleGuard>
                }
              />
              <Route
                path="users"
                element={
                  <RoleGuard allow={["coordinator"]}>
                    <UserManagement />
                  </RoleGuard>
                }
              />
              <Route
                path="history"
                element={
                  <RoleGuard allow={["coordinator"]}>
                    <History />
                  </RoleGuard>
                }
              />
              <Route path="training/:trainingId" element={<TrainingDetail />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
