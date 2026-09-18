const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-dollar currency for headline numbers. */
export function money(n: number): string {
  return usd.format(Math.round(n));
}

/** Currency with cents for tables and details. */
export function moneyExact(n: number): string {
  return usdCents.format(n);
}

/** "+$430" / "−$110" with a proper minus sign. */
export function signedMoney(n: number, exact = false): string {
  const abs = Math.abs(n);
  const s = exact ? usdCents.format(abs) : usd.format(abs);
  if (Math.round(exact ? abs * 100 : abs) === 0) return s;
  return n > 0 ? `+${s}` : `−${s}`;
}

export function percent(ratio: number, digits = 0): string {
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(digits)}%`;
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
