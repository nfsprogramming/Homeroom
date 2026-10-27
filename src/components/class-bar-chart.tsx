import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export interface ClassBarPoint {
  label: string;
  rate: number;
}

export function ClassBarChart({
  points,
  className,
}: {
  points: ClassBarPoint[];
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) return <div className={cn("h-52", className)} />;

  return (
    <div className={cn("h-52 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as ClassBarPoint;
              return (
                <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-border">
                  <p className="font-medium">{row.label}</p>
                  <p className="tabular-nums text-muted-foreground">{row.rate}%</p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="rate"
            fill="var(--color-primary)"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
