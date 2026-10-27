import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyCounts,
  addStatus,
  finalizeRate,
  countsFor,
  dayCompletion,
  reportsForStudents,
  formatRate,
} from "./stats.ts";
import {
  isWeekendISO,
  isSchoolDay,
  schoolDays,
  shiftSchoolDay,
} from "./dates.ts";

test("stats: emptyCounts and addStatus", () => {
  const counts = emptyCounts();
  assert.equal(counts.present, 0);
  assert.equal(counts.rate, null);

  addStatus(counts, "present");
  addStatus(counts, "late");
  addStatus(counts, "absent");
  addStatus(counts, "excused");

  assert.equal(counts.present, 1);
  assert.equal(counts.late, 1);
  assert.equal(counts.absent, 1);
  assert.equal(counts.excused, 1);
  assert.equal(counts.attended, 2); // present + late
  assert.equal(counts.rated, 3); // present + late + absent (excused excluded)
  assert.equal(counts.marked, 4);

  finalizeRate(counts);
  assert.equal(counts.rate, 66.7);
});

test("stats: countsFor and dayCompletion", () => {
  const records = {
    "s1|2026-10-26": "present" as const,
    "s1|2026-10-27": "absent" as const,
    "s2|2026-10-26": "present" as const,
  };

  const counts = countsFor(["s1"], ["2026-10-26", "2026-10-27"], records);
  assert.equal(counts.attended, 1);
  assert.equal(counts.rated, 2);
  assert.equal(counts.rate, 50);

  const done = dayCompletion(["s1", "s2"], "2026-10-26", records);
  assert.equal(done.marked, 2);
  assert.equal(done.total, 2);

  const partial = dayCompletion(["s1", "s2"], "2026-10-27", records);
  assert.equal(partial.marked, 1);
  assert.equal(partial.total, 2);
});

test("stats: reportsForStudents atRisk flag", () => {
  const students = [
    { id: "s1", classId: "c1", firstName: "Alice", lastName: "Smith", rollNo: "01" },
    { id: "s2", classId: "c1", firstName: "Bob", lastName: "Jones", rollNo: "02" },
  ];
  const records = {
    "s1|2026-10-26": "present" as const,
    "s2|2026-10-26": "absent" as const,
  };

  const reports = reportsForStudents(students, ["2026-10-26"], records);
  assert.equal(reports[0]?.atRisk, false); // Alice is 100%
  assert.equal(reports[1]?.atRisk, true); // Bob is 0% (< 80%)
});

test("stats: formatRate", () => {
  assert.equal(formatRate(null), "—");
  assert.equal(formatRate(85), "85%");
  assert.equal(formatRate(92.5), "92.5%");
});

test("dates: weekends and schoolDays", () => {
  // 2026-10-24 is Saturday, 2026-10-25 is Sunday, 2026-10-26 is Monday
  assert.equal(isWeekendISO("2026-10-24"), true);
  assert.equal(isWeekendISO("2026-10-25"), true);
  assert.equal(isWeekendISO("2026-10-26"), false);
  assert.equal(isSchoolDay("2026-10-26"), true);

  const days = schoolDays("2026-10-23", "2026-10-27");
  // Fri 23, Mon 26, Tue 27 (weekend 24, 25 skipped)
  assert.deepEqual(days, ["2026-10-23", "2026-10-26", "2026-10-27"]);

  assert.equal(shiftSchoolDay("2026-10-23", 1), "2026-10-26"); // Friday + 1 -> Monday
  assert.equal(shiftSchoolDay("2026-10-26", -1), "2026-10-23"); // Monday - 1 -> Friday
});
