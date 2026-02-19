import { Link } from "react-router-dom";
import { BookOpen, ClipboardList, FileText, Search, User, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PrimateLogo } from "@/components/PrimateLogo";
import { Card, CardContent } from "@/components/ui/card";

type QuickLink = {
  label: string;
  description: string;
  to: string;
  icon: typeof BookOpen;
};

export default function Home() {
  const { profile, role } = useAuth();

  const roleLabel = role === "coordinator" ? "Coordinator" : role === "supervisor" ? "Supervisor" : "Employee";

  const quickLinks: QuickLink[] = [
    {
      label: "Training List",
      description: "Review your assigned trainings and required items.",
      to: "/dashboard/training-list",
      icon: BookOpen,
    },
    {
      label: "In Progress",
      description: "Continue trainings that are currently underway.",
      to: "/dashboard/in-progress",
      icon: ClipboardList,
    },
    {
      label: "Training Report",
      description: "Log completed training activity and updates.",
      to: "/dashboard/report",
      icon: FileText,
    },
    {
      label: "Agent Train",
      description: "Use the assistant for training-report related help.",
      to: "/dashboard/report-agent",
      icon: Search,
    },
    {
      label: "My Profile",
      description: "View your role, assignments, and account details.",
      to: "/dashboard/profile",
      icon: User,
    },
  ];

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-xl bg-primary px-6 py-10 sm:px-10 sm:py-14">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-4">
          <PrimateLogo className="hidden h-12 w-12 text-secondary sm:block" />
          <div>
            <h1 className="text-2xl font-bold text-primary-foreground sm:text-3xl lg:text-4xl">
              Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}.
            </h1>
            <p className="mt-1 text-primary-foreground/70">
              {roleLabel} · WaNBRC Training Portal
            </p>
          </div>
        </div>
      </div>

      {/* Quick links grid */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Links</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => (
            <Link key={item.label} to={item.to} className="group">
              <Card className="h-full border border-border bg-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-lg">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{item.label}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
