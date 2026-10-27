import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAttendanceStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/attendance", label: "Take roll", icon: ClipboardCheck },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/roster", label: "Roster", icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    void useAttendanceStore.getState().initialize();
    function syncIfVisible() {
      if (document.visibilityState === "visible") {
        void useAttendanceStore.getState().refresh();
      }
    }
    const timer = window.setInterval(syncIfVisible, 60_000);
    document.addEventListener("visibilitychange", syncIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", syncIfVisible);
    };
  }, []);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useAttendanceStore((s) => s.user);
  const loading = useAttendanceStore((s) => s.loading);
  const error = useAttendanceStore((s) => s.error);
  const schoolName = user?.schoolName ?? "Homeroom";

  useEffect(() => {
    if (user && error) toast.error(`Live sync failed: ${error}`);
  }, [user, error]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        Connecting to your school register…
      </div>
    );
  }

  if (!user) return <SignIn />;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 pt-8 pb-6">
          <p className="font-display text-3xl tracking-tight italic">Homeroom</p>
          <p className="mt-1 text-xs tracking-widest text-sidebar-muted uppercase">
            {schoolName}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "pressable flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium",
                  active
                    ? "bg-sidebar-hover text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-6 text-xs text-sidebar-muted">{user.email}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-sm md:h-16 md:px-8">
          <div className="md:hidden">
            <p className="font-display text-xl italic leading-none">Homeroom</p>
            <p className="text-xs text-muted-foreground">{schoolName}</p>
          </div>
          <p className="hidden text-sm text-muted-foreground md:block">
            Student attendance register
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  void useAttendanceStore
                    .getState()
                    .signOut()
                    .catch((error: unknown) => {
                      toast.error(error instanceof Error ? error.message : "Could not sign out");
                    });
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-12">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm md:hidden">
        <ul className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SignIn() {
  const [registering, setRegistering] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const user = useAttendanceStore((s) => s.user);
  const error = useAttendanceStore((s) => s.error);
  const signIn = useAttendanceStore((s) => s.signIn);
  const signUp = useAttendanceStore((s) => s.signUp);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (registering) {
        await signUp({ schoolName, email, password });
      } else {
        await signIn(email, password);
      }
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  }

  if (user) return null;

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9">
        <p className="font-display text-3xl italic">Homeroom</p>
        <h1 className="mt-7 text-2xl">
          {registering ? "Set up your school" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {registering
            ? "Create a secure school account to start a private attendance register."
            : "Sign in to your school's attendance register."}
        </p>
        {error ? (
          <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}. Check that the Python API is running and VITE_API_URL is configured.
          </p>
        ) : null}
        <form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}>
          {registering ? (
            <div className="grid gap-2">
              <Label htmlFor="school-name">School name</Label>
              <Input
                id="school-name"
                required
                minLength={2}
                maxLength={120}
                value={schoolName}
                onChange={(event) => setSchoolName(event.target.value)}
                autoComplete="organization"
              />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={registering ? 12 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={registering ? "new-password" : "current-password"}
            />
            {registering ? (
              <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>
            ) : null}
          </div>
          <Button type="submit" className="mt-2 w-full" disabled={submitting}>
            {submitting ? "Please wait…" : registering ? "Create school account" : "Sign in"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-5 min-h-11 w-full text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setRegistering((value) => !value)}
        >
          {registering ? "Already have an account? Sign in" : "New school? Create an account"}
        </button>
      </section>
    </main>
  );
}
