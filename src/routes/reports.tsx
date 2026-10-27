import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { ClassBarChart } from "@/components/class-bar-chart";
import { StudentDetailDialog } from "@/components/student-detail";
import { TrendChart } from "@/components/trend-chart";
import { AvatarMark } from "@/components/avatar-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  rangeForPreset,
  schoolDays,
  TERM_LABEL,
  type DatePreset,
} from "@/lib/dates";
import {
  AT_RISK_THRESHOLD,
  countsFor,
  dailyRates,
  formatRate,
  reportsForStudents,
  type StudentReport,
} from "@/lib/stats";
import { useAttendanceStore } from "@/lib/store";
import { studentName } from "@/lib/types";
import { cn } from "@/lib/utils";

type Search = { classId?: string; preset?: DatePreset; q?: string };

const PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "ten", label: "Last 10 days" },
  { id: "term", label: "Year to date" },
];

export const Route = createFileRoute("/reports")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    classId: typeof search.classId === "string" ? search.classId : undefined,
    preset:
      search.preset === "week" ||
      search.preset === "month" ||
      search.preset === "ten" ||
      search.preset === "term"
        ? search.preset
        : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: ReportsPage,
});

type SortKey = "name" | "rate" | "absent";

function ReportsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const classes = useAttendanceStore((s) => s.classes);
  const students = useAttendanceStore((s) => s.students);
  const records = useAttendanceStore((s) => s.records);
  const schoolName = useAttendanceStore((s) => s.user?.schoolName ?? "School");

  const preset: DatePreset = search.preset ?? "term";
  const { from, to } = rangeForPreset(preset);
  const dates = schoolDays(from, to);
  const classId = search.classId;
  const query = (search.q ?? "").trim().toLowerCase();

  const cohort = students.filter((s) => (classId ? s.classId === classId : true));
  const reports = reportsForStudents(cohort, dates, records);
  const [sort, setSort] = useState<SortKey>("rate");
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = reports.filter((r) => {
      if (!query) return true;
      const room = classes.find((c) => c.id === r.student.classId);
      const hay = `${studentName(r.student)} ${r.student.rollNo} ${room?.grade ?? ""} ${room?.name ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
    list.sort((a, b) => {
      if (sort === "name") return studentName(a.student).localeCompare(studentName(b.student));
      if (sort === "absent") return b.counts.absent - a.counts.absent;
      const ar = a.counts.rate ?? 101;
      const br = b.counts.rate ?? 101;
      return ar - br;
    });
    return list;
  }, [reports, query, sort, classes]);

  const ids = cohort.map((s) => s.id);
  const totals = countsFor(ids, dates, records);
  const atRisk = reports.filter((r) => r.atRisk).length;
  const points = dailyRates(ids, dates.slice(-20), records);
  const classBars = classes
    .filter((c) => (classId ? c.id === classId : true))
    .map((c) => {
      const cids = students.filter((s) => s.classId === c.id).map((s) => s.id);
      const rate = countsFor(cids, dates, records).rate ?? 0;
      return { label: `${c.grade} ${c.name}`, rate };
    });

  const detail: StudentReport | undefined = reports.find(
    (r) => r.student.id === detailId,
  );
  const detailClass = classes.find((c) => c.id === detail?.student.classId);

  function setSearch(patch: Partial<Search>) {
    void navigate({
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
    });
  }

  function exportCsv() {
    const escapeCsv = (val: string | number) => {
      const str = String(val);
      const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const header = [
      "Class",
      "Roll",
      "Student",
      "Present",
      "Late",
      "Absent",
      "Excused",
      "Rate",
    ].map(escapeCsv);
    const lines = filtered.map((r) => {
      const room = classes.find((c) => c.id === r.student.classId);
      const klass = room ? `${room.grade} ${room.name}` : "";
      return [
        klass,
        r.student.rollNo,
        studentName(r.student),
        r.counts.present,
        r.counts.late,
        r.counts.absent,
        r.counts.excused,
        r.counts.rate ?? "",
      ]
        .map(escapeCsv)
        .join(",");
    });
    const csv = `\uFEFF${header.join(",")}\n${lines.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `homeroom-attendance-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Report downloaded");
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {schoolName} · {TERM_LABEL}
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl">Attendance report</h1>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSearch({ preset: p.id })}
              className={cn(
                "pressable h-11 shrink-0 rounded-full border px-4 text-sm font-medium",
                preset === p.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <FilterChip
            active={!classId}
            onClick={() => setSearch({ classId: undefined })}
            label="All classes"
          />
          {classes.map((c) => (
            <FilterChip
              key={c.id}
              active={classId === c.id}
              onClick={() => setSearch({ classId: c.id })}
              label={`${c.grade} ${c.name}`}
            />
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q ?? ""}
            onChange={(e) => setSearch({ q: e.target.value || undefined })}
            placeholder="Search students"
            className="pl-10"
            aria-label="Search students"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Attendance" value={formatRate(totals.rate)} />
        <Kpi label="Present + late" value={String(totals.attended)} />
        <Kpi label="Absences" value={String(totals.absent)} />
        <Kpi label="At risk" value={String(atRisk)} hint={`Below ${AT_RISK_THRESHOLD}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily rate</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart points={points} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By class</CardTitle>
          </CardHeader>
          <CardContent>
            <ClassBarChart points={classBars} />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <p className="text-sm font-medium tabular-nums">{filtered.length} students</p>
          <div className="flex gap-1">
            {(
              [
                ["rate", "Rate"],
                ["absent", "Absences"],
                ["name", "Name"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={cn(
                  "pressable h-9 rounded-md px-3 text-xs font-medium",
                  sort === key ? "bg-secondary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-3 py-3 font-medium">Class</th>
                <th className="px-3 py-3 text-right font-medium">P</th>
                <th className="px-3 py-3 text-right font-medium">L</th>
                <th className="px-3 py-3 text-right font-medium">A</th>
                <th className="px-3 py-3 text-right font-medium">E</th>
                <th className="px-5 py-3 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const room = classes.find((c) => c.id === row.student.classId);
                return (
                  <tr
                    key={row.student.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/60"
                    onClick={() => setDetailId(row.student.id)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <AvatarMark
                          first={row.student.firstName}
                          last={row.student.lastName}
                          accent={room?.accent}
                          className="size-9"
                        />
                        <div>
                          <p className="font-medium">{studentName(row.student)}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Roll {row.student.rollNo}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {room ? `${room.grade}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.counts.present}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.counts.late}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.counts.absent}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.counts.excused}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {row.atRisk ? <Badge variant="risk">At risk</Badge> : null}
                        <span className="font-medium tabular-nums">
                          {formatRate(row.counts.rate)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    No students match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <StudentDetailDialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        student={detail?.student ?? null}
        classroom={detailClass}
        counts={detail?.counts ?? null}
        from={from}
        to={to}
        records={records}
      />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="mt-2 font-display text-3xl tracking-tight tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable h-11 shrink-0 rounded-full border px-4 text-sm font-medium",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
