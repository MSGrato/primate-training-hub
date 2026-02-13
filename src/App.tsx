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
              <Route path="employee-reports" element={<EmployeeReports />} />
              <Route path="approvals" element={<ApprovalQueue />} />
              <Route path="manage-trainings" element={<ManageTrainings />} />
              <Route path="job-tags" element={<JobTags />} />
              <Route path="job-titles" element={<JobTitles />} />
              <Route path="users" element={<UserManagement />} />
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
