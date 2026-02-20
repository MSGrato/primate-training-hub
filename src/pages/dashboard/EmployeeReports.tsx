import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ArrowUpDown, Search } from "lucide-react";

type SortKey = "full_name" | "job_title";
type SortDir = "asc" | "desc";

export default function EmployeeReports() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [jobTitles, setJobTitles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & sort state
  const [search, setSearch] = useState("");
  const [jobTitleFilter, setJobTitleFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Fetch job titles for filter dropdown
      const { data: titles } = await supabase.from("job_titles").select("id, name");
      setJobTitles(titles || []);

      if (role === "coordinator") {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, full_name, is_active, job_title_id, job_title:job_titles(name)");
        setEmployees(data || []);
      } else {
        const { data: mappings } = await supabase
          .from("supervisor_employee_mappings")
          .select("employee_id")
          .eq("supervisor_id", user.id);
        const employeeIds = mappings?.map((m) => m.employee_id) || [];
        if (employeeIds.length > 0) {
          const { data } = await supabase
            .from("profiles")
            .select("user_id, full_name, is_active, job_title_id, job_title:job_titles(name)")
            .in("user_id", employeeIds);
          setEmployees(data || []);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user, role]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let list = [...employees];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.full_name?.toLowerCase().includes(q));
    }

    // Job title filter
    if (jobTitleFilter !== "all") {
      list = list.filter((e) => e.job_title_id === jobTitleFilter);
    }

    // Sort
    list.sort((a, b) => {
      let aVal = "";
      let bVal = "";
      if (sortKey === "full_name") {
        aVal = a.full_name?.toLowerCase() || "";
        bVal = b.full_name?.toLowerCase() || "";
      } else if (sortKey === "job_title") {
        aVal = a.job_title?.name?.toLowerCase() || "";
        bVal = b.job_title?.name?.toLowerCase() || "";
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [employees, search, jobTitleFilter, sortKey, sortDir]);

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Employee Training Reports</h1>

      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={jobTitleFilter} onValueChange={setJobTitleFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All Job Titles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Job Titles</SelectItem>
            {jobTitles.map((jt) => (
              <SelectItem key={jt.id} value={jt.id}>{jt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
            <p>{employees.length === 0 ? "No employees found." : "No employees match your filters."}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("full_name")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Employee
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("job_title")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Job Title
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.user_id}>
                    <TableCell className="font-medium">{e.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.job_title?.name || "—"}
                    </TableCell>
                    <TableCell>
                      {e.is_active ? (
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => navigate(`/dashboard/report-agent?employee=${encodeURIComponent(e.full_name)}`)}
                        >
                          View Report
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
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
