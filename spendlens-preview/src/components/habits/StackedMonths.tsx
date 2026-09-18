"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { AXIS_TICK, CURSOR, ChartTooltip, GRID, SURFACE, compactAxis } from "../charts/shared";
import { CategoryIcon } from "../ui/CategoryIcon";

export function StackedMonths({ data, keys }: { data: Array<Record<string, number | string>>; keys: Category[] }) {
  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} {...GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} width={56} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip />} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} name={k} stackId="a" fill={CATEGORY_COLORS[k]} stroke={SURFACE} strokeWidth={2} maxBarSize={36} radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-secondary">
        {keys.map((k) => (
          <li key={k} className="flex items-center gap-1.5"><CategoryIcon category={k} size={18} />{k}</li>
        ))}
      </ul>
    </div>
  );
}
