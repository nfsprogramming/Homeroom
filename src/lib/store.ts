import { create } from "zustand";
import type { ClassAccent, ClassRoom, Status, Student } from "@/lib/types";
import { recKey } from "@/lib/types";

interface SchoolUser {
  id: string;
  email: string;
  schoolName: string;
}

interface ApiClass {
  id: string;
  name: string;
  grade: string;
  room: string;
  teacher: string;
  accent: ClassAccent;
}

interface ApiStudent {
  id: string;
  class_id: string;
  first_name: string;
  last_name: string;
  roll_no: string;
}

interface ApiRecord {
  student_id: string;
  date: string;
  status: Status;
}

interface ApiSnapshot {
  classes: ApiClass[];
  students: ApiStudent[];
  records: ApiRecord[];
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
let csrfToken: string | null = null;

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; authenticated?: boolean } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.authenticated && method !== "GET" && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const error = (await response.json()) as { detail?: string };
      if (error.detail) message = error.detail;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function mapStudent(student: ApiStudent): Student {
  return {
    id: student.id,
    classId: student.class_id,
    firstName: student.first_name,
    lastName: student.last_name,
    rollNo: student.roll_no,
  };
}

function mapUser(payload: {
  id: string;
  email: string;
  school_name: string;
  csrf_token: string;
}): SchoolUser {
  csrfToken = payload.csrf_token;
  return { id: payload.id, email: payload.email, schoolName: payload.school_name };
}

function snapshotState(snapshot: ApiSnapshot) {
  const records: Record<string, Status> = {};
  for (const record of snapshot.records) {
    records[recKey(record.student_id, record.date)] = record.status;
  }
  return {
    classes: snapshot.classes,
    students: snapshot.students.map(mapStudent),
    records,
  };
}

export interface AttendanceState {
  classes: ClassRoom[];
  students: Student[];
  records: Record<string, Status>;
  user: SchoolUser | null;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    schoolName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  setStatus: (studentId: string, date: string, status: Status) => Promise<void>;
  setMany: (studentIds: string[], date: string, status: Status) => Promise<void>;
  clearDay: (studentIds: string[], date: string) => Promise<void>;
  addClass: (input: {
    name: string;
    grade: string;
    room: string;
    teacher: string;
    accent: ClassAccent;
  }) => Promise<string>;
  removeClass: (id: string) => Promise<void>;
  addStudent: (input: {
    classId: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  updateStudent: (
    id: string,
    patch: Partial<Omit<Student, "id">>,
  ) => Promise<void>;
  removeStudent: (id: string) => Promise<void>;
}

async function fetchSnapshot() {
  return snapshotState(await request<ApiSnapshot>("/snapshot"));
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  classes: [],
  students: [],
  records: {},
  user: null,
  loading: true,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const payload = await request<{
        id: string;
        email: string;
        school_name: string;
        csrf_token: string;
      }>("/auth/session");
      const user = mapUser(payload);
      set({ user, ...(await fetchSnapshot()), loading: false });
    } catch (error) {
      csrfToken = null;
      if (error instanceof Error && error.message === "Sign in required") {
        set({ user: null, classes: [], students: [], records: {}, loading: false });
        return;
      }
      if (error instanceof Error && error.message === "Session expired") {
        set({ user: null, classes: [], students: [], records: {}, loading: false });
        return;
      }
      set({ loading: false, error: error instanceof Error ? error.message : "Unable to connect to the server" });
    }
  },

  refresh: async () => {
    if (!get().user) return;
    try {
      set({ ...(await fetchSnapshot()), error: null });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "Sign in required" || error.message === "Session expired")
      ) {
        csrfToken = null;
        set({ user: null, classes: [], students: [], records: {} });
        return;
      }
      set({ error: error instanceof Error ? error.message : "Unable to refresh data" });
    }
  },

  signIn: async (email, password) => {
    const user = mapUser(
      await request<{
        id: string;
        email: string;
        school_name: string;
        csrf_token: string;
      }>("/auth/login", { method: "POST", body: { email, password } }),
    );
    set({ user, ...(await fetchSnapshot()), error: null });
  },

  signUp: async ({ schoolName, email, password }) => {
    const user = mapUser(
      await request<{
        id: string;
        email: string;
        school_name: string;
        csrf_token: string;
      }>("/auth/register", {
        method: "POST",
        body: { school_name: schoolName, email, password },
      }),
    );
    set({ user, ...(await fetchSnapshot()), error: null });
  },

  signOut: async () => {
    try {
      await request("/auth/logout", { method: "POST", authenticated: true });
    } finally {
      csrfToken = null;
      set({ user: null, classes: [], students: [], records: {} });
    }
  },

  setStatus: async (studentId, date, status) => {
    await get().setMany([studentId], date, status);
  },

  setMany: async (studentIds, date, status) => {
    await request("/attendance", {
      method: "PUT",
      authenticated: true,
      body: { date, marks: studentIds.map((student_id) => ({ student_id, status })) },
    });
    set((state) => {
      const records = { ...state.records };
      for (const id of studentIds) records[recKey(id, date)] = status;
      return { records };
    });
  },

  clearDay: async (studentIds, date) => {
    await request("/attendance", {
      method: "DELETE",
      authenticated: true,
      body: { date, student_ids: studentIds },
    });
    set((state) => {
      const records = { ...state.records };
      for (const id of studentIds) delete records[recKey(id, date)];
      return { records };
    });
  },

  addClass: async (input) => {
    const classroom = await request<ClassRoom>("/classes", {
      method: "POST",
      authenticated: true,
      body: input,
    });
    set((state) => ({ classes: [...state.classes, classroom] }));
    return classroom.id;
  },

  removeClass: async (id) => {
    await request(`/classes/${id}`, { method: "DELETE", authenticated: true });
    set((state) => {
      const removedIds = new Set(
        state.students.filter((student) => student.classId === id).map((student) => student.id),
      );
      const records = { ...state.records };
      for (const key of Object.keys(records)) {
        if (removedIds.has(key.slice(0, key.indexOf("|")))) delete records[key];
      }
      return {
        classes: state.classes.filter((classroom) => classroom.id !== id),
        students: state.students.filter((student) => student.classId !== id),
        records,
      };
    });
  },

  addStudent: async ({ classId, ...input }) => {
    const student = await request<ApiStudent>(`/classes/${classId}/students`, {
      method: "POST",
      authenticated: true,
      body: { first_name: input.firstName, last_name: input.lastName },
    });
    set((state) => ({ students: [...state.students, mapStudent(student)] }));
  },

  updateStudent: async (id, patch) => {
    const student = await request<ApiStudent>(`/students/${id}`, {
      method: "PATCH",
      authenticated: true,
      body: { first_name: patch.firstName, last_name: patch.lastName },
    });
    set((state) => ({
      students: state.students.map((item) => (item.id === id ? mapStudent(student) : item)),
    }));
  },

  removeStudent: async (id) => {
    await request(`/students/${id}`, { method: "DELETE", authenticated: true });
    set((state) => {
      const records = { ...state.records };
      for (const key of Object.keys(records)) {
        if (key.startsWith(`${id}|`)) delete records[key];
      }
      return {
        students: state.students.filter((student) => student.id !== id),
        records,
      };
    });
  },
}));

if (typeof window !== "undefined") {
  (window as unknown as { useAttendanceStore: typeof useAttendanceStore }).useAttendanceStore = useAttendanceStore;
}

