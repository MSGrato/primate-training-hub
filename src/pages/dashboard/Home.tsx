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
    <div className="relative min-h-[calc(100vh-3.5rem)] -m-3 sm:-m-4 lg:-m-6 p-6 sm:p-8 lg:p-12 overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-secondary/15 blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-secondary/10 blur-3xl translate-y-1/3 -translate-x-1/4" />
      <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full bg-primary-foreground/5 blur-2xl -translate-x-1/2 -translate-y-1/2" />

      <div className="relative z-10 space-y-8 max-w-screen-2xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold sm:text-4xl text-secondary drop-shadow-md">Home</h1>
          <p className="text-primary-foreground/80 text-lg">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}. Choose where to go from the navigation or quick links below.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) =>
          <Link key={item.label} to={item.to} className="group">
              <Card className="h-full border border-primary-foreground/10 bg-primary-foreground/10 backdrop-blur-sm shadow-sm transition-all duration-200 group-hover:bg-primary-foreground/20 group-hover:shadow-md group-hover:-translate-y-1 group-hover:border-secondary/40">
                <CardHeader className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/20 text-secondary shadow-sm">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl text-primary-foreground">{item.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-primary-foreground/70">{item.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </div>);

}