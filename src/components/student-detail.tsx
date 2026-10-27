import { AttendanceHeatmap } from "@/components/heatmap";
import { AvatarMark } from "@/components/avatar-mark";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLong } from "@/lib/dates";
import { formatRate, type CountSet } from "@/lib/stats";
import type { ClassRoom, Status, Student } from "@/lib/types";
import { studentName } from "@/lib/types";

export function StudentDetailDialog({
  open,
  onOpenChange,
  student,
  classroom,
  counts,
  from,
  to,
  records,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  classroom: ClassRoom | undefined;
  counts: CountSet | null;
  from: string;
  to: string;
  records: Record<string, Status>;
}) {
  if (!student || !counts) return null;

  const tiles: Array<{ label: string; value: number; key: Status | "rate" }> = [
    { label: "Present", value: counts.present, key: "present" },
    { label: "Late", value: counts.late, key: "late" },
    { label: "Absent", value: counts.absent, key: "absent" },
    { label: "Excused", value: counts.excused, key: "excused" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AvatarMark
              first={student.firstName}
              last={student.lastName}
              accent={classroom?.accent}
            />
            <div>
              <DialogTitle>{studentName(student)}</DialogTitle>
              <DialogDescription>
                {classroom
                  ? `${classroom.grade} ${classroom.name} · Roll ${student.rollNo}`
                  : `Roll ${student.rollNo}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              Attendance
            </p>
            <p className="font-display text-4xl tracking-tight tabular-nums">
              {formatRate(counts.rate)}
            </p>
          </div>
          {counts.rate !== null && counts.rate < 80 ? (
            <Badge variant="risk">At risk</Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {tiles.map((t) => (
            <div key={t.key} className="rounded-lg bg-muted/70 px-2 py-3 text-center">
              <p className="text-lg font-medium tabular-nums">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-3 text-xs tracking-wide text-muted-foreground uppercase">
            {formatLong(from).split(",")[1] ? "Term calendar" : "Calendar"}
          </p>
          <AttendanceHeatmap
            studentId={student.id}
            from={from}
            to={to}
            records={records}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
