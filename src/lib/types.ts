export const STATUSES = ["present", "late", "absent", "excused"] as const;
export type Status = (typeof STATUSES)[number];

export type ClassAccent = "teal" | "olive" | "ink";

export interface ClassRoom {
  id: string;
  name: string;
  grade: string;
  room: string;
  teacher: string;
  accent: ClassAccent;
}

export interface Student {
  id: string;
  classId: string;
  firstName: string;
  lastName: string;
  rollNo: string;
}

export const STATUS_META: Record<
  Status,
  { label: string; short: string }
> = {
  present: { label: "Present", short: "P" },
  late: { label: "Late", short: "L" },
  absent: { label: "Absent", short: "A" },
  excused: { label: "Excused", short: "E" },
};

export function recKey(studentId: string, date: string) {
  return `${studentId}|${date}`;
}

export function parseRecKey(key: string): { studentId: string; date: string } {
  const split = key.indexOf("|");
  return { studentId: key.slice(0, split), date: key.slice(split + 1) };
}

export function studentName(s: Pick<Student, "firstName" | "lastName">) {
  return `${s.firstName} ${s.lastName}`;
}
