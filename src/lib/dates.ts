import {
  addDays,
  format,
  getDay,
  isAfter,
  isBefore,
  isEqual,
  startOfWeek,
} from "date-fns";

export const TERM_START = `${new Date().getFullYear()}-01-01`;
export const TERM_LABEL = "Year to date";

export function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function isWeekendISO(iso: string): boolean {
  const day = getDay(parseLocal(iso));
  return day === 0 || day === 6;
}

export function isSchoolDay(iso: string): boolean {
  return !isWeekendISO(iso);
}

export function schoolDays(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = parseLocal(from);
  const end = parseLocal(to);
  while (isBefore(cur, end) || isEqual(cur, end)) {
    const iso = toISO(cur);
    if (!isWeekendISO(iso)) out.push(iso);
    cur = addDays(cur, 1);
  }
  return out;
}

export function shiftSchoolDay(iso: string, dir: 1 | -1): string {
  let cur = parseLocal(iso);
  do {
    cur = addDays(cur, dir);
  } while (getDay(cur) === 0 || getDay(cur) === 6);
  return toISO(cur);
}

export function formatLong(iso: string): string {
  return format(parseLocal(iso), "EEEE, d MMMM yyyy");
}

export function formatMedium(iso: string): string {
  return format(parseLocal(iso), "EEE d MMM");
}

export function formatShort(iso: string): string {
  return format(parseLocal(iso), "d MMM");
}

export function formatDayTick(iso: string): string {
  return format(parseLocal(iso), "d");
}

export function mondayOfWeek(iso: string): string {
  return toISO(startOfWeek(parseLocal(iso), { weekStartsOn: 1 }));
}

export function monthStart(iso: string): string {
  const d = parseLocal(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function clampRange(from: string, to: string): { from: string; to: string } {
  if (isAfter(parseLocal(from), parseLocal(to))) return { from: to, to: from };
  return { from, to };
}

export type DatePreset = "week" | "month" | "term" | "ten";

export function rangeForPreset(
  preset: DatePreset,
  today = todayISO(),
): { from: string; to: string } {
  switch (preset) {
    case "week":
      return { from: mondayOfWeek(today), to: today };
    case "month":
      return { from: monthStart(today), to: today };
    case "ten": {
      const days = schoolDays(TERM_START, today);
      const from = days[Math.max(0, days.length - 10)] ?? today;
      return { from, to: today };
    }
    case "term":
    default:
      return { from: TERM_START, to: today };
  }
}
