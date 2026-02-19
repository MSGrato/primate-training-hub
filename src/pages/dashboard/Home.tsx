import { Link } from "react-router-dom";
import { BookOpen, ClipboardList, FileText, Search, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type QuickLink = {
  label: string;
  description: string;
  to: string;
  icon: typeof BookOpen;
};

export default function Home() {
  const { profile } = useAuth();

  const quickLinks: QuickLink[] = [
  {
    label: "Training List",
    description: "Review your assigned trainings and required items.",
    to: "/dashboard/training-list",
    icon: BookOpen
  },
  {
    label: "In Progress",
    description: "Continue trainings that are currently underway.",
    to: "/dashboard/in-progress",
    icon: ClipboardList
  },
  {
    label: "Training Report",
    description: "Log completed training activity and updates.",
    to: "/dashboard/report",
    icon: FileText
  },
  {
    label: "Agent Train",
    description: "Use the assistant for training-report related help.",
    to: "/dashboard/report-agent",
    icon: Search
  },
  {
    label: "My Profile",
    description: "View your role, assignments, and account details.",
    to: "/dashboard/profile",
    icon: User
  }];


  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold sm:text-4xl text-secondary">Home</h1>
        <p className="text-secondary">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}. Choose where to go from the navigation or quick links below.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {quickLinks.map((item) =>
        <Link key={item.label} to={item.to} className="group">
            <Card className="h-full border-2 border-border bg-card shadow-lg transition-all duration-200 group-hover:border-primary group-hover:shadow-xl group-hover:-translate-y-1">
              <CardHeader className="space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-sm">
                  <item.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{item.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>);

}