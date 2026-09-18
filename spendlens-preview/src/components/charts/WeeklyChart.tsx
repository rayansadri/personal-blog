"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/dates";
import { AXIS_TICK, CURSOR, ChartTooltip, GRID, INK, compactAxis } from "./shared";

export function WeeklyChart({ data }: { data: Array<{ weekStart: string; amount: number }> }) {
  const rows = data.map((d) => ({ ...d, label: formatDate(d.weekStart) }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} width={56} />
          <Tooltip cursor={CURSOR} content={<ChartTooltip labelFormatter={(l) => `Week of ${l}`} />} />
          <Bar dataKey="amount" name="Spending" fill={INK} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
