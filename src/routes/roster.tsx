import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AvatarMark } from "@/components/avatar-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAttendanceStore } from "@/lib/store";
import type { ClassAccent, Student } from "@/lib/types";
import { studentName } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/roster")({ component: RosterPage });

const ACCENTS: ClassAccent[] = ["teal", "olive", "ink"];

function RosterPage() {
  const classes = useAttendanceStore((s) => s.classes);
  const students = useAttendanceStore((s) => s.students);
  const addClass = useAttendanceStore((s) => s.addClass);
  const removeClass = useAttendanceStore((s) => s.removeClass);
  const addStudent = useAttendanceStore((s) => s.addStudent);
  const removeStudent = useAttendanceStore((s) => s.removeStudent);
  const updateStudent = useAttendanceStore((s) => s.updateStudent);

  const [classOpen, setClassOpen] = useState(false);
  const [studentFor, setStudentFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">People</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">Roster</h1>
        </div>
        <Button onClick={() => setClassOpen(true)}>
          <Plus />
          Add class
        </Button>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center">
          <p className="font-display text-2xl">No classes</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a class, then add students to start taking roll.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {classes.map((classroom) => {
            const cohort = students
              .filter((s) => s.classId === classroom.id)
              .slice()
              .sort((a, b) =>
                a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }),
              );
            return (
              <section key={classroom.id} className="surface-card overflow-hidden rounded-2xl">
                <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      {classroom.grade} · Room {classroom.room}
                    </p>
                    <h2 className="font-display text-2xl">{classroom.name}</h2>
                    <p className="text-sm text-muted-foreground">{classroom.teacher}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setStudentFor(classroom.id)}
                    >
                      <Plus />
                      Add student
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Remove ${classroom.grade} ${classroom.name}`}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete ${classroom.grade} ${classroom.name}? This permanently removes all students in this class and their attendance history.`,
                          )
                        ) {
                          return;
                        }
                        void removeClass(classroom.id)
                          .then(() => toast("Class removed"))
                          .catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "Class could not be removed"),
                          );
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </header>
                {cohort.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-muted-foreground">
                    No students yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {cohort.map((student) => (
                      <li
                        key={student.id}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <AvatarMark
                          first={student.firstName}
                          last={student.lastName}
                          accent={classroom.accent}
                          className="size-9"
                        />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setEditing(student)}
                        >
                          <p className="truncate font-medium">{studentName(student)}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Roll {student.rollNo}
                          </p>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${studentName(student)}`}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Remove ${studentName(student)}? This permanently deletes their attendance records.`,
                              )
                            ) {
                              return;
                            }
                            void removeStudent(student.id)
                              .then(() => toast("Student removed"))
                              .catch((error: unknown) =>
                                toast.error(error instanceof Error ? error.message : "Student could not be removed"),
                              );
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <ClassDialog
        open={classOpen}
        onOpenChange={setClassOpen}
        onSubmit={(input) => {
          void addClass(input)
            .then(() => {
              setClassOpen(false);
              toast("Class added");
            })
            .catch((error: unknown) =>
              toast.error(error instanceof Error ? error.message : "Class could not be added"),
            );
        }}
      />
      <StudentDialog
        open={studentFor !== null}
        onOpenChange={(open) => {
          if (!open) setStudentFor(null);
        }}
        title="Add student"
        submitLabel="Add"
        onSubmit={(name) => {
          if (!studentFor) return;
          void addStudent({ classId: studentFor, ...name })
            .then(() => {
              setStudentFor(null);
              toast("Student added");
            })
            .catch((error: unknown) =>
              toast.error(error instanceof Error ? error.message : "Student could not be added"),
            );
        }}
      />
      <StudentDialog
        key={editing?.id ?? "student-edit-dialog"}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="Edit student"
        submitLabel="Save"
        initial={editing ?? undefined}
        onSubmit={(name) => {
          if (!editing) return;
          void updateStudent(editing.id, name)
            .then(() => {
              setEditing(null);
              toast("Student updated");
            })
            .catch((error: unknown) =>
              toast.error(error instanceof Error ? error.message : "Student could not be updated"),
            );
        }}
      />
    </div>
  );
}

function ClassDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    name: string;
    grade: string;
    room: string;
    teacher: string;
    accent: ClassAccent;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [accent, setAccent] = useState<ClassAccent>("teal");

  function reset() {
    setName("");
    setGrade("");
    setRoom("");
    setTeacher("");
    setAccent("teal");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New class</DialogTitle>
          <DialogDescription>Added to the live register immediately.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !grade.trim()) return;
            onSubmit({
              name: name.trim(),
              grade: grade.trim(),
              room: room.trim() || "—",
              teacher: teacher.trim() || "Unassigned",
              accent,
            });
            reset();
          }}
        >
          <Field label="Subject" value={name} onChange={setName} required placeholder="English" />
          <Field label="Grade / section" value={grade} onChange={setGrade} required placeholder="8A" />
          <Field label="Room" value={room} onChange={setRoom} placeholder="12" />
          <Field label="Teacher" value={teacher} onChange={setTeacher} placeholder="Ms. Hale" />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Accent</legend>
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAccent(a)}
                  className={cn(
                    "size-10 rounded-md border",
                    a === "teal" && "bg-accent-teal",
                    a === "olive" && "bg-accent-olive",
                    a === "ink" && "bg-accent-ink",
                    accent === a ? "border-foreground" : "border-transparent",
                  )}
                  aria-label={a}
                />
              ))}
            </div>
          </fieldset>
          <Button type="submit">Create class</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StudentDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  initial?: Student;
  onSubmit: (name: { firstName: string; lastName: string }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && initial) {
          setFirstName(initial.firstName);
          setLastName(initial.lastName);
        }
        if (!next) {
          setFirstName("");
          setLastName("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!firstName.trim() || !lastName.trim()) return;
            onSubmit({ firstName: firstName.trim(), lastName: lastName.trim() });
          }}
        >
          <Field label="First name" value={firstName} onChange={setFirstName} required />
          <Field label="Last name" value={lastName} onChange={setLastName} required />
          <Button type="submit">{submitLabel}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}