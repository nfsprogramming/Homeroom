import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShort } from "@/lib/dates";
import type { DailyPoint } from "@/lib/stats";
import { cn } from "@/lib/utils";

export function TrendChart({
  points,
  className,
}: {
  points: DailyPoint[];
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const data = points.map((p) => ({
    ...p,
    label: formatShort(p.date),
    value: p.rate,
  }));

  if (!ready) {
    return <div className={cn("h-52", className)} />;
  }

  return (
    <div className={cn("h-52 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-border">
                  <p className="font-medium text-foreground">{row.label}</p>
                  <p className="tabular-nums text-muted-foreground">
                    {row.rate === null ? "No roll" : `${row.rate}% present`}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
            connectNulls
            activeDot={{ r: 4, fill: "var(--color-primary)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
