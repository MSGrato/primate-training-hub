import {
  BookOpen,
  ClipboardList,
  FileText,
  Users,
  Tag,
  Briefcase,
  UserPlus,
  CheckSquare,
  User,
  History as HistoryIcon,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrimateLogo } from "@/components/PrimateLogo";

export function AppSidebar() {
  const { profile, role, signOut } = useAuth();

  const employeeItems = [
    { title: "Training List", url: "/dashboard", icon: BookOpen },
    { title: "In Progress", url: "/dashboard/in-progress", icon: ClipboardList },
    { title: "Training Report", url: "/dashboard/report", icon: FileText },
    { title: "My Profile", url: "/dashboard/profile", icon: User },
  ];

  const supervisorItems = [
    { title: "Employee Reports", url: "/dashboard/employee-reports", icon: Users },
    { title: "Approval Queue", url: "/dashboard/approvals", icon: CheckSquare },
  ];

  const coordinatorItems = [
    { title: "Manage Trainings", url: "/dashboard/manage-trainings", icon: BookOpen },
    { title: "Job Tags", url: "/dashboard/job-tags", icon: Tag },
    { title: "Job Titles", url: "/dashboard/job-titles", icon: Briefcase },
    { title: "User Management", url: "/dashboard/users", icon: UserPlus },
    { title: "History", url: "/dashboard/history", icon: HistoryIcon },
  ];

  const isSupervisorOrAbove = role === "supervisor" || role === "coordinator";
  const isCoordinator = role === "coordinator";

  const roleLabel = role === "coordinator" ? "Coordinator" : role === "supervisor" ? "Supervisor" : "Employee";

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <PrimateLogo className="h-6 w-6 text-secondary" />
          <span className="text-lg font-bold text-sidebar-foreground">WaNBRC Train</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">My Training</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {employeeItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-secondary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSupervisorOrAbove && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">Supervisor</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {supervisorItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        activeClassName="bg-sidebar-accent text-secondary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isCoordinator && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {coordinatorItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        activeClassName="bg-sidebar-accent text-secondary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-sidebar-foreground/80 truncate">{profile?.full_name || "User"}</span>
          <Badge className="bg-secondary text-secondary-foreground text-xs">{roleLabel}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
