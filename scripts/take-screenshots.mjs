import { firefox } from "playwright";
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "e:/homeroom/homeroom/docs/screenshots";
const ARTIFACT_DIR = "C:/Users/NFS Photographer/.gemini/antigravity-ide/brain/f5f2aaad-8017-4a87-a011-dcb19b4d9c40";

mkdirSync(OUT_DIR, { recursive: true });

async function saveScreenshot(page, filename) {
  const localPath = join(OUT_DIR, filename);
  await page.screenshot({ path: localPath });
  try {
    copyFileSync(localPath, join(ARTIFACT_DIR, filename));
  } catch (err) {
    console.warn("Could not copy to artifact dir:", err.message);
  }
  console.log(`Saved screenshot: ${filename}`);
}

async function run() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:8080...");
  await page.goto("http://localhost:8080", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // 1. Sign in screen
  await saveScreenshot(page, "01-signin.png");

  // 2. Click "New school? Create an account"
  const toggleBtn = page.locator("button:has-text('New school? Create an account')");
  if (await toggleBtn.isVisible()) {
    await toggleBtn.click();
    await page.waitForTimeout(500);
    await saveScreenshot(page, "01b-register.png");

    // Register a school
    const randomSuffix = Math.floor(Math.random() * 10000);
    await page.fill("#school-name", "Oakridge Academy");
    await page.fill("#email", `principal${randomSuffix}@oakridge.edu`);
    await page.fill("#password", "Oakridge2026!Attendance");
    await page.click("button[type='submit']");
    await page.waitForTimeout(2000);
  }

  // Populate realistic sample data through the Zustand store
  console.log("Seeding sample classes, students, and attendance...");
  await page.evaluate(async () => {
    const store = window.useAttendanceStore.getState();
    const c1Id = await store.addClass({
      name: "Algebra I",
      grade: "Grade 8A",
      room: "101",
      teacher: "Ms. Clara Bennett",
      accent: "teal",
    });
    const c2Id = await store.addClass({
      name: "Literature & Composition",
      grade: "Grade 8B",
      room: "104",
      teacher: "Mr. David Ross",
      accent: "olive",
    });
    const c3Id = await store.addClass({
      name: "Physical Science",
      grade: "Grade 9A",
      room: "202",
      teacher: "Dr. Elena Vance",
      accent: "ink",
    });

    // Add students
    const studentsData = [
      { classId: c1Id, firstName: "Maya", lastName: "Lin" },
      { classId: c1Id, firstName: "Lucas", lastName: "Alvarez" },
      { classId: c1Id, firstName: "Sophia", lastName: "Chen" },
      { classId: c1Id, firstName: "Liam", lastName: "O'Connor" },
      { classId: c2Id, firstName: "Emma", lastName: "Watson" },
      { classId: c2Id, firstName: "Noah", lastName: "Kowalski" },
      { classId: c2Id, firstName: "Aria", lastName: "Sharma" },
      { classId: c3Id, firstName: "Ethan", lastName: "Nakamura" },
      { classId: c3Id, firstName: "Zoe", lastName: "Dubois" },
      { classId: c3Id, firstName: "Oliver", lastName: "Smith" },
    ];
    for (const s of studentsData) {
      await store.addStudent(s);
    }

    await store.refresh();
    const students = window.useAttendanceStore.getState().students;

    // Past 15 school days
    const dates = [];
    const d = new Date();
    while (dates.length < 15) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        dates.push(d.toISOString().slice(0, 10));
      }
      d.setDate(d.getDate() - 1);
    }

    for (const date of dates) {
      for (let idx = 0; idx < students.length; idx++) {
        const student = students[idx];
        let status = "present";
        if (idx === 1 && date === dates[0]) status = "absent";
        else if (idx === 3 && (date === dates[1] || date === dates[2])) status = "absent";
        else if (idx === 2 && date === dates[3]) status = "late";
        else if (idx === 4 && date === dates[2]) status = "excused";
        else if (idx === 7 && (date === dates[4] || date === dates[5] || date === dates[6])) status = "absent";
        await store.setStatus(student.id, date, status);
      }
    }
    await store.refresh();
  });

  // Reload to update all views
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 3. Dashboard / Overview
  await saveScreenshot(page, "02-dashboard-overview.png");

  // 4. Attendance Roll Call screen
  await page.click("a[href='/attendance']");
  await page.waitForTimeout(1200);
  await saveScreenshot(page, "03-attendance-roll-call.png");

  // 5. Roster screen
  await page.click("a[href='/roster']");
  await page.waitForTimeout(1200);
  await saveScreenshot(page, "04-roster-management.png");

  // 6. Reports screen
  await page.click("a[href='/reports']");
  await page.waitForTimeout(1200);
  await saveScreenshot(page, "05-attendance-reports.png");

  // 7. Click on student row to open detail modal with calendar heatmap
  const studentRow = page.locator("tbody tr").first();
  await studentRow.scrollIntoViewIfNeeded();
  await studentRow.click();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, "06-student-detail-heatmap.png");

  await browser.close();
  console.log("All screenshots captured successfully!");
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
