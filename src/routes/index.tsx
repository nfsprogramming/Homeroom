import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardCheck, TriangleAlert } from "lucide-react";
import { AvatarMark } from "@/components/avatar-mark";
import { StatusBadge } from "@/components/status-badge";
import { TrendChart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatLong,
  formatMedium,
  isSchoolDay,
  schoolDays,
  TERM_LABEL,
  TERM_START,
  todayISO,
} from "@/lib/dates";
import {
  AT_RISK_THRESHOLD,
  countsFor,
  dailyRates,
  dayCompletion,
  formatRate,
  recentAbsences,
  reportsForStudents,
} from "@/lib/stats";
import { useAttendanceStore } from "@/lib/store";
import { studentName, type ClassAccent } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const STRIPE: Record<ClassAccent, string> = {
  teal: "bg-accent-teal",
  olive: "bg-accent-olive",
  ink: "bg-accent-ink",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Home() {
  const classes = useAttendanceStore((s) => s.classes);
  const students = useAttendanceStore((s) => s.students);
  const records = useAttendanceStore((s) => s.records);

  const today = todayISO();
  const schoolToday = isSchoolDay(today);
  const termDays = schoolDays(TERM_START, today);
  const historyDays = schoolDays(TERM_START, today).filter((d) => d !== today);
  const chartDays = historyDays.slice(-15);
  const allIds = students.map((s) => s.id);
  const term = countsFor(allIds, termDays, records);
  const todayCounts = countsFor(allIds, [today], records);
  const points = dailyRates(allIds, chartDays, records);
  const atRisk = reportsForStudents(students, termDays, records)
    .filter((r) => r.atRisk)
    .sort((a, b) => (a.counts.rate ?? 100) - (b.counts.rate ?? 100));
  const recents = recentAbsences(students, historyDays, records, 6);
  const classById = new Map(classes.map((c) => [c.id, c]));

  const pending = classes
    .map((c) => {
      const ids = students.filter((s) => s.classId === c.id).map((s) => s.id);
      const { marked, total } = dayCompletion(ids, today, records);
      return { classroom: c, marked, total };
    })
    .filter((c) => c.total > 0 && c.marked < c.total);

  const kpis = [
    {
      label: "Year-to-date attendance",
      value: formatRate(term.rate),
      hint: TERM_LABEL,
    },
    {
      label: "Present today",
      value: schoolToday ? String(todayCounts.present + todayCounts.late) : "—",
      hint: schoolToday ? `${todayCounts.marked} marked` : "Weekend",
    },
    {
      label: "Absences today",
      value: schoolToday ? String(todayCounts.absent) : "—",
      hint: `${todayCounts.excused} excused`,
    },
    {
      label: "At risk",
      value: String(atRisk.length),
      hint: `Below ${AT_RISK_THRESHOLD}%`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">{formatLong(today)}</h1>
        </div>
        <Button asChild>
          <Link to="/attendance">
            <ClipboardCheck />
            Take roll
          </Link>
        </Button>
      </div>

      {classes.length === 0 ? (
        <section className="rounded-3xl border border-border bg-card px-6 py-10 sm:px-10">
          <p className="text-sm font-medium text-primary">Your register is ready</p>
          <h2 className="mt-2 text-2xl sm:text-3xl">Start with your first class</h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Add a class and its students to begin taking attendance. Your school’s data is saved securely to its account.
          </p>
          <Button asChild className="mt-6">
            <Link to="/roster">Set up your roster</Link>
          </Button>
        </section>
      ) : null}

      {schoolToday && pending.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-late/15 text-late">
              <TriangleAlert className="size-4" />
            </span>
            <div>
              <p className="font-medium">
                {pending.length === classes.length
                  ? "Today’s roll has not been taken"
                  : `${pending.length} ${pending.length === 1 ? "class needs" : "classes need"} a roll`}
              </p>
              <p className="text-sm text-muted-foreground">
                {pending.map((p) => p.classroom.grade).join(", ")}
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link
              to="/attendance"
              search={{ classId: pending[0]?.classroom.id }}
            >
              Continue
              <ArrowRight />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {k.label}
              </p>
              <p className="mt-2 font-display text-3xl tracking-tight tabular-nums">
                {k.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Daily attendance</CardTitle>
            <p className="text-sm text-muted-foreground">
              School-wide rate, last {chartDays.length} school days
            </p>
          </CardHeader>
          <CardContent>
            <TrendChart points={points} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent absences</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4">
            {recents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No absences in range.</p>
            ) : (
              recents.map((ev) => {
                const room = classById.get(ev.student.classId);
                return (
                  <div
                    key={`${ev.student.id}-${ev.date}-${ev.status}`}
                    className="flex items-center gap-3"
                  >
                    <AvatarMark
                      first={ev.student.firstName}
                      last={ev.student.lastName}
                      accent={room?.accent}
                      className="size-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {studentName(ev.student)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMedium(ev.date)}
                        {room ? ` · ${room.grade}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={ev.status} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">Classes</h2>
          <Link to="/roster" className="text-sm text-muted-foreground hover:text-foreground">
            Manage roster
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const cohort = students.filter((s) => s.classId === c.id);
            const ids = cohort.map((s) => s.id);
            const termC = countsFor(ids, termDays, records);
            const { marked, total } = dayCompletion(ids, today, records);
            const rate = termC.rate ?? 0;
            return (
              <Link
                key={c.id}
                to="/attendance"
                search={{ classId: c.id }}
                className="surface-card pressable block overflow-hidden rounded-2xl"
              >
                <span className={cn("block h-1 w-full", STRIPE[c.accent])} />
                <div className="p-5">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    {c.grade} · Room {c.room}
                  </p>
                  <p className="mt-1 font-display text-xl">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.teacher}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="tabular-nums text-muted-foreground">
                      {cohort.length} students
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatRate(termC.rate)} term
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, rate)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {schoolToday
                      ? marked === total && total > 0
                        ? "Roll complete today"
                        : `${marked} of ${total} marked today`
                      : "No school today"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {atRisk.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl">Needs attention</h2>
            <Link
              to="/reports"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Open reports
            </Link>
          </div>
          <Card>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {atRisk.slice(0, 6).map((row) => {
                const room = classById.get(row.student.classId);
                return (
                  <div
                    key={row.student.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <AvatarMark
                      first={row.student.firstName}
                      last={row.student.lastName}
                      accent={room?.accent}
                      className="size-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {studentName(row.student)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {room ? `${room.grade} ${room.name}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatRate(row.counts.rate)}
                    </span>
                    <Badge variant="risk">At risk</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
