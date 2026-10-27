import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { AvatarMark } from "@/components/avatar-mark";
import { StatusPicker } from "@/components/status-picker";
import { Button } from "@/components/ui/button";
import {
  formatLong,
  isSchoolDay,
  shiftSchoolDay,
  todayISO,
} from "@/lib/dates";
import { dayCompletion } from "@/lib/stats";
import { useAttendanceStore } from "@/lib/store";
import { recKey, studentName, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

type Search = { classId?: string; date?: string };

export const Route = createFileRoute("/attendance")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    classId: typeof search.classId === "string" ? search.classId : undefined,
    date: typeof search.date === "string" ? search.date : undefined,
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { classId: qClass, date: qDate } = Route.useSearch();
  const navigate = Route.useNavigate();
  const classes = useAttendanceStore((s) => s.classes);
  const students = useAttendanceStore((s) => s.students);
  const records = useAttendanceStore((s) => s.records);
  const setStatus = useAttendanceStore((s) => s.setStatus);
  const setMany = useAttendanceStore((s) => s.setMany);
  const clearDay = useAttendanceStore((s) => s.clearDay);

  const date =
    qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : todayISO();
  const activeClass =
    classes.find((c) => c.id === qClass) ?? classes[0] ?? null;

  const cohort = students
    .filter((s) => (activeClass ? s.classId === activeClass.id : false))
    .slice()
    .sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));

  const { marked, total } = dayCompletion(
    cohort.map((s) => s.id),
    date,
    records,
  );
  const remaining = cohort.filter((s) => !records[recKey(s.id, date)]);
  const school = isSchoolDay(date);

  function setDate(next: string) {
    void navigate({
      search: (prev) => ({ ...prev, date: next }),
      replace: true,
    });
  }

  function setClass(id: string) {
    void navigate({
      search: (prev) => ({ ...prev, classId: id }),
      replace: true,
    });
  }

  function markRemainingPresent() {
    void setMany(
      remaining.map((s) => s.id),
      date,
      "present",
    )
      .then(() => toast(`Marked ${remaining.length} present`))
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Attendance could not be saved"),
      );
  }

  if (classes.length === 0) {
    return (
      <Empty
        title="No classes yet"
        body="Add a class and students on the roster to take roll."
        to="/roster"
        cta="Open roster"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Take roll</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">
            {activeClass ? `${activeClass.grade} ${activeClass.name}` : "Select a class"}
          </h1>
          {activeClass ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {activeClass.teacher} · Room {activeClass.room}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous school day"
            onClick={() => setDate(shiftSchoolDay(date, -1))}
          >
            <ChevronLeft />
          </Button>
          <div className="min-w-40 px-2 text-center text-sm font-medium">
            {formatLong(date)}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next school day"
            onClick={() => setDate(shiftSchoolDay(date, 1))}
            disabled={shiftSchoolDay(date, 1) > todayISO()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {classes.map((c) => {
          const ids = students.filter((s) => s.classId === c.id).map((s) => s.id);
          const done = dayCompletion(ids, date, records);
          const active = activeClass?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setClass(c.id)}
              className={cn(
                "pressable flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {c.grade} {c.name}
              {school && done.total > 0 && done.marked === done.total ? (
                <Check className="size-3.5" />
              ) : null}
            </button>
          );
        })}
      </div>

      {!school ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center">
          <p className="font-display text-2xl">No school today</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Weekends are skipped in the register. Jump to the last school day.
          </p>
          <Button className="mt-5" onClick={() => setDate(shiftSchoolDay(date, -1))}>
            Last school day
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              {marked} of {total} recorded
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={remaining.length === 0}
                onClick={markRemainingPresent}
              >
                Mark rest present
              </Button>
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 ease-[var(--ease-smooth-out)]"
              style={{ width: total === 0 ? "0%" : `${(marked / total) * 100}%` }}
            />
          </div>

          {cohort.length === 0 ? (
            <Empty
              title="No students in this class"
              body="Add students on the roster, then return to take roll."
              to="/roster"
              cta="Open roster"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {cohort.map((student) => {
                const value = records[recKey(student.id, date)] as Status | undefined;
                return (
                  <li
                    key={student.id}
                className="surface-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <AvatarMark
                        first={student.firstName}
                        last={student.lastName}
                        accent={activeClass?.accent}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{studentName(student)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Roll {student.rollNo}
                        </p>
                      </div>
                    </div>
                    <div className="sm:w-80 md:w-96">
                      <StatusPicker
                        name={studentName(student)}
                        value={value}
                        onChange={(status) =>
                          void setStatus(student.id, date, status).catch((error: unknown) =>
                            toast.error(
                              error instanceof Error ? error.message : "Attendance could not be saved",
                            ),
                          )
                        }
                        onClear={() =>
                          void clearDay([student.id], date).catch((error: unknown) =>
                            toast.error(
                              error instanceof Error ? error.message : "Attendance could not be cleared",
                            ),
                          )
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {total > 0 && marked === total ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Roll complete for this class.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function Empty({
  title,
  body,
  to,
  cta,
}: {
  title: string;
  body: string;
  to: "/roster";
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center">
      <p className="font-display text-2xl">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-5">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}
