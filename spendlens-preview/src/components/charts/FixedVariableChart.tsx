"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthPoint } from "@/lib/analytics/summary";
import { ACCENT, AXIS_TICK, CURSOR, ChartTooltip, GRID, SURFACE, compactAxis } from "./shared";

const VARIABLE = "var(--chart-secondary)";

export function FixedVariableChart({ data }: { data: MonthPoint[] }) {
  return (
    <div>
      <div className="h-52 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} {...GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} width={56} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip />} />
            <Bar dataKey="fixed" name="Fixed" stackId="a" fill={ACCENT} maxBarSize={28} stroke={SURFACE} strokeWidth={2} />
            <Bar dataKey="variable" name="Variable" stackId="a" fill={VARIABLE} radius={[4, 4, 0, 0]} maxBarSize={28} stroke={SURFACE} strokeWidth={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-5 text-[12.5px] text-ink-secondary">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} />Fixed</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: VARIABLE }} />Variable</span>
      </div>
    </div>
  );
}
