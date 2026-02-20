import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

type Row = Record<string, unknown>;

type SortState = {
  column: string;
  direction: "asc" | "desc";
} | null;

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (typeof value === "string") {
    const maybeDate = new Date(value);
    if (!Number.isNaN(maybeDate.getTime()) && value.includes("T")) return maybeDate.toLocaleDateString();
    return value;
  }
  return String(JSON.stringify(value) ?? "—");
}

function compareValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

type SortableReportTableProps = {
  rows: Row[];
  maxRows: number;
};

export default function SortableReportTable({ rows, maxRows }: SortableReportTableProps) {
  const [sort, setSort] = useState<SortState>(null);

  const headers = useMemo(() => {
    if (rows.length === 0) return [];
    const keys = Object.keys(rows[0]);
    // Preferred display order for report columns
    const preferredOrder = [
      "net_id", "full_name", "job_title", "training_title", "category",
      "frequency", "status", "last_completed_at", "next_due_at",
      "total", "compliant", "overdue", "due_soon", "not_started", "completion_rate",
      "training_name", "due_date", "match_score",
    ];
    return keys.sort((a, b) => {
      const ai = preferredOrder.indexOf(a);
      const bi = preferredOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [rows]);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const cmp = compareValues(a[sort.column], b[sort.column]);
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

  const visibleRows = sortedRows.slice(0, maxRows);

  const handleSort = (column: string) => {
    setSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === "asc" ? { column, direction: "desc" } : null;
      }
      return { column, direction: "asc" };
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sort?.column !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sort.direction === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="rounded-md border overflow-auto max-h-[300px]">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead
                key={header}
                className="text-xs whitespace-nowrap cursor-pointer select-none hover:bg-muted/50 transition-colors"
                onClick={() => handleSort(header)}
              >
                <span className="inline-flex items-center">
                  {header.split("_").join(" ")}
                  <SortIcon column={header} />
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row, idx) => (
            <TableRow key={idx}>
              {headers.map((header) => (
                <TableCell key={header} className="text-xs whitespace-nowrap">
                  {renderValue(row[header])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
