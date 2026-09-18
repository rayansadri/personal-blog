import { z } from "zod";

/**
 * EPIC 5: the strict output contract for AI interpretation. Every claim must
 * point at feature ids that exist in the input; the validator enforces it.
 */

export const ArchetypeSchema = z.object({
  name: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  evidenceFeatureIds: z.array(z.string()),
});

export const PatternSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  importance: z.enum(["high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
  evidenceFeatureIds: z.array(z.string()),
  trend: z.enum(["strengthening", "weakening", "stable", "new"]),
  startedAt: z.string().nullable(),
});

export const TimelineNarrativeSchema = z.object({
  date: z.string(),
  title: z.string(),
  summary: z.string(),
  evidenceFeatureIds: z.array(z.string()),
});

export const NotableChangeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  impact: z.string(),
  evidenceFeatureIds: z.array(z.string()),
});

export const InterpretationSchema = z.object({
  profile: z.object({
    summary: z.string(),
    archetypes: z.array(ArchetypeSchema),
  }),
  patterns: z.array(PatternSchema),
  timelineNarrative: z.array(TimelineNarrativeSchema),
  notableChanges: z.array(NotableChangeSchema),
});

export type Interpretation = z.infer<typeof InterpretationSchema>;
export type Archetype = z.infer<typeof ArchetypeSchema>;

// ---------- validation ----------

export interface ValidationResult {
  interpretation: Interpretation;
  /** Claims removed and why. Surfaced in the UI's trust drawer. */
  dropped: Array<{ where: string; reason: string }>;
}

/** Forbidden framings: psychological or medical diagnosis. */
const FORBIDDEN = /\b(depress|anxi|impulsive personality|addict|compulsive|disorder|emotional(ly)? (shop|spend)|self[- ]?medicat|bipolar|adhd|ocd|therapy|mental health)\b/i;

/** Pull every number out of a string: "$1,240", "26.9%", "2.1x", "2026-08". */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/-?\$?\d[\d,]*(?:\.\d+)?/g)) {
    const raw = m[0].replace(/[$,]/g, "");
    if (/^\d{4}$/.test(raw) && Number(raw) >= 1990 && Number(raw) <= 2100) continue; // years
    if (/^\d{4}-\d{2}/.test(text.slice(m.index!, m.index! + 7))) continue; // dates like 2026-08
    const n = Number(raw);
    if (Number.isFinite(n)) out.push(Math.abs(n));
  }
  return out;
}

/** True when every number in `text` is derivable from the allowed set (exact, rounded, or within 1.5%). */
export function numbersSupported(text: string, allowed: Set<number>): boolean {
  const allowedArr = [...allowed];
  return numbersIn(text).every((n) => {
    if (n <= 12 && Number.isInteger(n)) return true; // small counts like "3 of 6 months" are fine
    return allowedArr.some((a) => {
      const A = Math.abs(a);
      if (Math.abs(A - n) < 0.5) return true; // rounding to whole
      if (Math.abs(Math.round(A) - n) < 0.5) return true;
      if (A > 0 && Math.abs(A - n) / A <= 0.015) return true; // 1.5% tolerance
      if (A > 0 && Math.abs(A * 100 - n) / (A * 100) <= 0.015) return true; // ratio expressed as percent
      return false;
    });
  });
}

export function validateInterpretation(raw: unknown, allowedFeatureIds: Set<string>, allowedNumbers: Set<number>): ValidationResult {
  const parsed = InterpretationSchema.parse(raw);
  const dropped: ValidationResult["dropped"] = [];
  const okIds = (ids: string[]) => ids.filter((id) => allowedFeatureIds.has(id));
  const check = (where: string, text: string, ids: string[]): boolean => {
    const kept = okIds(ids);
    if (!kept.length) {
      dropped.push({ where, reason: "no valid evidence feature ids" });
      return false;
    }
    if (FORBIDDEN.test(text)) {
      dropped.push({ where, reason: "psychological or medical framing" });
      return false;
    }
    if (!numbersSupported(text, allowedNumbers)) {
      dropped.push({ where, reason: "contains a number not present in the evidence" });
      return false;
    }
    return true;
  };

  const archetypes = parsed.profile.archetypes.filter((a) => check(`archetype:${a.name}`, `${a.name} ${a.description}`, a.evidenceFeatureIds)).map((a) => ({ ...a, evidenceFeatureIds: okIds(a.evidenceFeatureIds) }));
  const patterns = parsed.patterns.filter((p) => check(`pattern:${p.id}`, `${p.title} ${p.summary}`, p.evidenceFeatureIds)).map((p) => ({ ...p, evidenceFeatureIds: okIds(p.evidenceFeatureIds) }));
  const timelineNarrative = parsed.timelineNarrative.filter((t) => check(`timeline:${t.date}:${t.title}`, `${t.title} ${t.summary}`, t.evidenceFeatureIds)).map((t) => ({ ...t, evidenceFeatureIds: okIds(t.evidenceFeatureIds) }));
  const notableChanges = parsed.notableChanges.filter((c) => check(`change:${c.title}`, `${c.title} ${c.summary} ${c.impact}`, c.evidenceFeatureIds)).map((c) => ({ ...c, evidenceFeatureIds: okIds(c.evidenceFeatureIds) }));

  let summary = parsed.profile.summary;
  if (FORBIDDEN.test(summary) || !numbersSupported(summary, allowedNumbers)) {
    dropped.push({ where: "profile.summary", reason: FORBIDDEN.test(summary) ? "psychological or medical framing" : "contains a number not present in the evidence" });
    summary = "";
  }

  return { interpretation: { profile: { summary, archetypes }, patterns, timelineNarrative, notableChanges }, dropped };
}
