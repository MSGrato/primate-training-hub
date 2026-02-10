import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function EmployeeReports() {
  const { user, role } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      let employeeIds: string[] = [];
      if (role === "coordinator") {
        const { data } = await supabase.from("profiles").select("user_id, full_name");
        setEmployees(data || []);
      } else {
        const { data: mappings } = await supabase
          .from("supervisor_employee_mappings")
          .select("employee_id")
          .eq("supervisor_id", user.id);
        employeeIds = mappings?.map((m) => m.employee_id) || [];
        if (employeeIds.length > 0) {
          const { data } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", employeeIds);
          setEmployees(data || []);
        }
      }
      setLoading(false);
    };
    fetch();
  }, [user, role]);

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Employee Training Reports</h1>
      {employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
            <p>No employees found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.user_id}>
                    <TableCell className="font-medium">{e.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">View Report</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
