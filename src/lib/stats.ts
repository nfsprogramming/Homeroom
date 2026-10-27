import type { Status, Student } from "./types.ts";
import { recKey, studentName } from "./types.ts";

export const AT_RISK_THRESHOLD = 80;

export interface CountSet {
  present: number;
  late: number;
  absent: number;
  excused: number;
  marked: number;
  attended: number;
  rated: number;
  rate: number | null;
}

export function emptyCounts(): CountSet {
  return {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    marked: 0,
    attended: 0,
    rated: 0,
    rate: null,
  };
}

export function addStatus(counts: CountSet, status: Status | undefined) {
  if (!status) return;
  counts[status] += 1;
  counts.marked += 1;
  if (status === "present" || status === "late") counts.attended += 1;
  if (status !== "excused") counts.rated += 1;
}

export function finalizeRate(counts: CountSet): CountSet {
  counts.rate =
    counts.rated === 0 ? null : Math.round((counts.attended / counts.rated) * 1000) / 10;
  return counts;
}

export function countsFor(
  studentIds: string[],
  dates: string[],
  records: Record<string, Status>,
): CountSet {
  const counts = emptyCounts();
  for (const id of studentIds) {
    for (const date of dates) {
      addStatus(counts, records[recKey(id, date)]);
    }
  }
  return finalizeRate(counts);
}

export function dayCompletion(
  studentIds: string[],
  date: string,
  records: Record<string, Status>,
): { marked: number; total: number } {
  let marked = 0;
  for (const id of studentIds) {
    if (records[recKey(id, date)]) marked += 1;
  }
  return { marked, total: studentIds.length };
}

export interface StudentReport {
  student: Student;
  counts: CountSet;
  atRisk: boolean;
}

export function reportsForStudents(
  students: Student[],
  dates: string[],
  records: Record<string, Status>,
): StudentReport[] {
  return students.map((student) => {
    const counts = countsFor([student.id], dates, records);
    return {
      student,
      counts,
      atRisk: counts.rate !== null && counts.rate < AT_RISK_THRESHOLD,
    };
  });
}

export interface DailyPoint {
  date: string;
  rate: number | null;
  attended: number;
  rated: number;
}

export function dailyRates(
  studentIds: string[],
  dates: string[],
  records: Record<string, Status>,
): DailyPoint[] {
  return dates.map((date) => {
    const counts = countsFor(studentIds, [date], records);
    return {
      date,
      rate: counts.rate,
      attended: counts.attended,
      rated: counts.rated,
    };
  });
}

export interface AbsenceEvent {
  student: Student;
  date: string;
  status: Extract<Status, "absent" | "late" | "excused">;
}

export function recentAbsences(
  students: Student[],
  dates: string[],
  records: Record<string, Status>,
  limit = 6,
): AbsenceEvent[] {
  const out: AbsenceEvent[] = [];
  for (let i = dates.length - 1; i >= 0 && out.length < limit; i--) {
    const date = dates[i]!;
    for (const student of students) {
      const status = records[recKey(student.id, date)];
      if (status === "absent" || status === "late" || status === "excused") {
        out.push({ student, date, status });
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate}%`;
}

export function compareName(a: Student, b: Student) {
  return studentName(a).localeCompare(studentName(b));
}

export function statusOn(
  records: Record<string, Status>,
  studentId: string,
  date: string,
): Status | undefined {
  return records[recKey(studentId, date)];
}
