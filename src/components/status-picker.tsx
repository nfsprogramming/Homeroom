import { STATUSES, STATUS_META, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const SELECTED: Record<Status, string> = {
  present: "bg-present text-present-foreground border-present",
  late: "bg-late text-late-foreground border-late",
  absent: "bg-absent text-absent-foreground border-absent",
  excused: "bg-excused text-excused-foreground border-excused",
};

export function StatusPicker({
  value,
  onChange,
  onClear,
  name,
}: {
  value: Status | undefined;
  onChange: (status: Status) => void;
  onClear?: () => void;
  name: string;
}) {
  return (
    <div role="group" aria-label={`Attendance for ${name}`} className="grid grid-cols-4 gap-1.5">
      {STATUSES.map((status) => {
        const selected = value === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={selected}
            onClick={() => (selected && onClear ? onClear() : onChange(status))}
            className={cn(
              "pressable h-11 rounded-md border text-xs font-medium sm:text-sm",
              selected
                ? SELECTED[status]
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <span className="sm:hidden">{STATUS_META[status].short}</span>
            <span className="hidden sm:inline">{STATUS_META[status].label}</span>
          </button>
        );
      })}
    </div>
  );
}
