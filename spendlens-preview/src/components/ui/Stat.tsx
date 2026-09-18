import { clsx } from "@/lib/clsx";

export function Stat({
  label,
  value,
  delta,
  hint,
  size = "md",
}: {
  label: string;
  value: string;
  delta?: { text: string; tone: "up" | "down" | "neutral"; upIsBad?: boolean };
  hint?: string;
  size?: "md" | "lg";
}) {
  const color =
    !delta || delta.tone === "neutral"
      ? "text-ink-muted"
      : (delta.tone === "up") === (delta.upIsBad ?? true)
        ? "text-negative"
        : "text-positive";
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-muted">{label}</span>
      <span
        className={clsx(
          "font-semibold tracking-tight",
          size === "lg" ? "text-[40px] leading-none sm:text-[48px]" : "text-[26px] leading-none sm:text-[28px]",
        )}
      >
        {value}
      </span>
      {(delta || hint) && (
        <span className="text-[13px]">
          {delta && <span className={clsx("font-medium", color)}>{delta.text}</span>}
          {delta && hint && <span className="text-ink-muted"> · </span>}
          {hint && <span className="text-ink-muted">{hint}</span>}
        </span>
      )}
    </div>
  );
}
