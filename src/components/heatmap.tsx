import { format, getISOWeek } from "date-fns";
import { parseLocal, schoolDays } from "@/lib/dates";
import { STATUS_META, type Status } from "@/lib/types";
import { recKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const CELL: Record<Status, string> = {
  present: "bg-present",
  late: "bg-late",
  absent: "bg-absent",
  excused: "bg-excused",
};

export function AttendanceHeatmap({
  studentId,
  from,
  to,
  records,
}: {
  studentId: string;
  from: string;
  to: string;
  records: Record<string, Status>;
}) {
  const days = schoolDays(from, to);
  const weeks: string[][] = [];
  let currentWeek = -1;
  for (const iso of days) {
    const week = getISOWeek(parseLocal(iso));
    if (week !== currentWeek) {
      weeks.push([]);
      currentWeek = week;
    }
    weeks[weeks.length - 1]!.push(iso);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-1 text-center text-xs text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {weeks.map((week, i) => {
          const cells: Array<string | null> = [null, null, null, null, null];
          for (const iso of week) {
            const day = parseLocal(iso).getDay();
            if (day >= 1 && day <= 5) cells[day - 1] = iso;
          }
          return (
            <div key={i} className="grid grid-cols-5 gap-1">
              {cells.slice(0, 5).map((iso, j) => {
                if (!iso) return <span key={`e-${j}`} className="aspect-square" />;
                const status = records[recKey(studentId, iso)];
                return (
                  <span
                    key={iso}
                    title={`${format(parseLocal(iso), "d MMM")}${status ? ` · ${STATUS_META[status].label}` : " · No mark"}`}
                    className={cn(
                      "aspect-square rounded-sm",
                      status ? CELL[status] : "bg-muted",
                    )}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(Object.keys(CELL) as Status[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", CELL[s])} />
            {STATUS_META[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}
