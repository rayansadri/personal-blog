"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthPoint } from "@/lib/analytics/summary";
import { ACCENT, AXIS_TICK, CURSOR, ChartTooltip, GRID, INK_SOFT, compactAxis } from "./shared";

export function TrendChart({ data, highlight }: { data: MonthPoint[]; highlight: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} width={56} />
          <Tooltip cursor={CURSOR} content={<ChartTooltip />} />
          <Bar dataKey="total" name="Spending" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.month === highlight ? ACCENT : INK_SOFT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
