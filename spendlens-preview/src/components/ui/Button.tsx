"use client";

import { clsx } from "@/lib/clsx";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, ...rest }: Props) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-10 px-5 text-[14px]",
        variant === "primary" && "bg-ink text-ink-inverse hover:bg-ink/90",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-ink-secondary hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "border border-negative/30 text-negative hover:bg-negative-soft",
        className,
      )}
      {...rest}
    />
  );
}
