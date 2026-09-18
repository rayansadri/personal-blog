"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/categories";
import { money } from "@/lib/format";
import { ChartTooltip } from "./shared";
import { CategoryIcon } from "../ui/CategoryIcon";

export function CategoryDonut({
  data,
  total,
}: {
  data: Array<{ category: Category; amount: number; share: number }>;
  total: number;
}) {
  const top = data.slice(0, 7);
  const rest = data.slice(7).reduce((a, d) => a + d.amount, 0);
  const rows = rest > 0 ? [...top, { category: "Other" as Category, amount: rest, share: rest / total }] : top;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="amount" nameKey="category" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="var(--surface)" strokeWidth={2} cornerRadius={3} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.category} fill={CATEGORY_COLORS[r.category]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip labelFormatter={(_, p) => String(p[0]?.name ?? "")} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Total</span>
          <span className="text-[20px] font-semibold tracking-tight">{money(total)}</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-1">
        {rows.map((r) => (
          <li key={r.category} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-ink-secondary">
              <CategoryIcon category={r.category} size={22} />
              {r.category}
            </span>
            <span className="tabular font-medium">{Math.round(r.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
