import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

type SortOption =
  | "date_desc"
  | "date_asc"
  | "training_asc"
  | "training_desc"
  | "name_asc"
  | "name_desc"
  | "department_asc"
  | "department_desc"
  | "job_title_asc"
  | "job_title_desc"
  | "tag_asc"
  | "tag_desc";

interface HistoryRow {
  id: string;
  user_id: string;
  employee_name: string;
  training_title: string;
  department: string;
  job_title: string;
  tags: string[];
  completed_at: string;
  approved_at: string | null;
  status: "pending" | "approved" | "rejected";
}

export default function History() {
  const { user, role } = useAuth();
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameFilter, setNameFilter] = useState("");
  const [trainingFilter, setTrainingFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [jobTitleFilter, setJobTitleFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [alphabetFilter, setAlphabetFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

  useEffect(() => {
    if (!user || role !== "coordinator") {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      const { data: completionData } = await supabase
        .from("training_completions")
        .select("id, user_id, completed_at, approved_at, status, training:trainings(title)")
        .order("completed_at", { ascending: false });

      const userIds = Array.from(new Set((completionData || []).map((item: any) => item.user_id)));
      const { data: profileData } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name, job_title_id").in("user_id", userIds)
        : { data: [] };

      const titleIds = Array.from(
        new Set(
          (profileData || [])
            .map((profile: any) => profile.job_title_id)
            .filter((titleId: string | null): titleId is string => !!titleId),
        ),
      );

      const { data: titleData } = titleIds.length
        ? await supabase
            .from("job_titles")
            .select("id, name, description, job_title_tags(job_tag:job_tags(name))")
            .in("id", titleIds)
        : { data: [] };

      const profileById = new Map<string, { full_name: string; job_title_id: string | null }>();
      (profileData || []).forEach((profile: any) => {
        profileById.set(profile.user_id, {
          full_name: profile.full_name,
          job_title_id: profile.job_title_id,
        });
      });

      const titleById = new Map<string, { name: string; department: string; tags: string[] }>();
      (titleData || []).forEach((title: any) => {
        titleById.set(title.id, {
          name: title.name,
          department: title.description || "Unassigned",
          tags: (title.job_title_tags || [])
            .map((assignment: any) => assignment.job_tag?.name)
            .filter((tagName: string | null): tagName is string => !!tagName),
        });
      });

      const mappedRows: HistoryRow[] = (completionData || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        employee_name: profileById.get(item.user_id)?.full_name || "Unknown User",
        training_title: item.training?.title || "Untitled Training",
        department: titleById.get(profileById.get(item.user_id)?.job_title_id || "")?.department || "Unassigned",
        job_title: titleById.get(profileById.get(item.user_id)?.job_title_id || "")?.name || "Unassigned",
        tags: titleById.get(profileById.get(item.user_id)?.job_title_id || "")?.tags || [],
        completed_at: item.completed_at,
        approved_at: item.approved_at,
        status: item.status,
      }));

      setRows(mappedRows);
      setLoading(false);
    };

    fetchHistory();
  }, [user, role]);

  const availableLetters = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => row.training_title.trim().charAt(0).toUpperCase())
          .filter((value) => /[A-Z]/.test(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const availableDepartments = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.department))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const availableJobTitles = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.job_title))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const availableTags = useMemo(() => {
    return Array.from(new Set(rows.flatMap((row) => row.tags))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const lowerName = nameFilter.trim().toLowerCase();
    const lowerTraining = trainingFilter.trim().toLowerCase();
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    const nextRows = rows.filter((row) => {
      if (lowerName && !row.employee_name.toLowerCase().includes(lowerName)) return false;
      if (lowerTraining && !row.training_title.toLowerCase().includes(lowerTraining)) return false;
      if (alphabetFilter !== "all" && !row.training_title.toUpperCase().startsWith(alphabetFilter)) return false;
      if (departmentFilter !== "all" && row.department !== departmentFilter) return false;
      if (jobTitleFilter !== "all" && row.job_title !== jobTitleFilter) return false;
      if (tagFilter !== "all" && !row.tags.includes(tagFilter)) return false;

      const completedDate = new Date(row.completed_at);
      if (fromDate && completedDate < fromDate) return false;
      if (toDate && completedDate > toDate) return false;
      return true;
    });

    nextRows.sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
        case "training_asc":
          return a.training_title.localeCompare(b.training_title);
        case "training_desc":
          return b.training_title.localeCompare(a.training_title);
        case "name_asc":
          return a.employee_name.localeCompare(b.employee_name);
        case "name_desc":
          return b.employee_name.localeCompare(a.employee_name);
        case "department_asc":
          return a.department.localeCompare(b.department);
        case "department_desc":
          return b.department.localeCompare(a.department);
        case "job_title_asc":
          return a.job_title.localeCompare(b.job_title);
        case "job_title_desc":
          return b.job_title.localeCompare(a.job_title);
        case "tag_asc":
          return (a.tags[0] || "").localeCompare(b.tags[0] || "");
        case "tag_desc":
          return (b.tags[0] || "").localeCompare(a.tags[0] || "");
        case "date_desc":
        default:
          return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
      }
    });

    return nextRows;
  }, [
    rows,
    nameFilter,
    trainingFilter,
    departmentFilter,
    jobTitleFilter,
    tagFilter,
    alphabetFilter,
    dateFrom,
    dateTo,
    sortBy,
  ]);

  if (loading) return <div className="text-muted-foreground">Loading history...</div>;

  if (role !== "coordinator") {
    return <Navigate to="/dashboard/home" replace />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">History</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="history-name-filter">Name Filter</Label>
              <Input
                id="history-name-filter"
                placeholder="Filter by employee name"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-training-filter">Training Filter</Label>
              <Input
                id="history-training-filter"
                placeholder="Filter by training title"
                value={trainingFilter}
                onChange={(event) => setTrainingFilter(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Department Filter</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Job Title Filter</Label>
              <Select value={jobTitleFilter} onValueChange={setJobTitleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All job titles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableJobTitles.map((jobTitle) => (
                    <SelectItem key={jobTitle} value={jobTitle}>
                      {jobTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tag Filter</Label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Alphabet Filter</Label>
              <Select value={alphabetFilter} onValueChange={setAlphabetFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All letters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableLetters.map((letter) => (
                    <SelectItem key={letter} value={letter}>
                      {letter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-date-from">Date From</Label>
              <Input
                id="history-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-date-to">Date To</Label>
              <Input
                id="history-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Date (Newest First)</SelectItem>
                  <SelectItem value="date_asc">Date (Oldest First)</SelectItem>
                  <SelectItem value="training_asc">Training (A-Z)</SelectItem>
                  <SelectItem value="training_desc">Training (Z-A)</SelectItem>
                  <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                  <SelectItem value="department_asc">Department (A-Z)</SelectItem>
                  <SelectItem value="department_desc">Department (Z-A)</SelectItem>
                  <SelectItem value="job_title_asc">Job Title (A-Z)</SelectItem>
                  <SelectItem value="job_title_desc">Job Title (Z-A)</SelectItem>
                  <SelectItem value="tag_asc">Tag (A-Z)</SelectItem>
                  <SelectItem value="tag_desc">Tag (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isMobile ? (
        <div className="space-y-3">
          {filteredRows.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No history records match the selected filters.
              </CardContent>
            </Card>
          ) : (
            filteredRows.map((row) => (
              <Card key={row.id}>
                <CardContent className="pt-4 pb-4 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{row.employee_name}</p>
                    {row.status === "approved" ? (
                      <Badge className="bg-success text-success-foreground shrink-0">Approved</Badge>
                    ) : row.status === "rejected" ? (
                      <Badge className="bg-destructive text-destructive-foreground shrink-0">Rejected</Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">Pending</Badge>
                    )}
                  </div>
                  <p className="text-sm">{row.training_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.completed_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.department} · {row.job_title}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Training</TableHead>
                  <TableHead>Completed Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No history records match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.employee_name}</TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell>{row.job_title}</TableCell>
                      <TableCell>{row.tags.length > 0 ? row.tags.join(", ") : "—"}</TableCell>
                      <TableCell>{row.training_title}</TableCell>
                      <TableCell>{new Date(row.completed_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {row.status === "approved" ? (
                          <Badge className="bg-success text-success-foreground">Approved</Badge>
                        ) : row.status === "rejected" ? (
                          <Badge className="bg-destructive text-destructive-foreground">Rejected</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
