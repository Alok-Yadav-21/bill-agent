/**
 * Money is ALWAYS stored and computed as integer minor units (pence for GBP).
 * £42.50 -> 4250. Floating-point money is never allowed anywhere in this app.
 *
 * These helpers are pure and dependency-free so they can be unit-tested in
 * isolation and reused on both server and client.
 */

export type CurrencyCode = "GBP" | "USD" | "EUR";

interface CurrencyMeta {
  symbol: string;
  /** Number of minor units in one major unit (100 for pence-based currencies). */
  minorPerMajor: number;
  locale: string;
}

const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  GBP: { symbol: "£", minorPerMajor: 100, locale: "en-GB" },
  USD: { symbol: "$", minorPerMajor: 100, locale: "en-US" },
  EUR: { symbol: "€", minorPerMajor: 100, locale: "en-IE" },
};

export const DEFAULT_CURRENCY: CurrencyCode = "GBP";

/**
 * Parse a user-entered major-unit string/number (e.g. "42.50", 42.5) into
 * integer minor units. Throws on anything that is not a clean, finite,
 * non-negative-or-signed money value. Rounding is done deliberately with
 * Math.round on a scaled integer to avoid float drift.
 */
export function toMinorUnits(
  value: string | number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): number {
  const { minorPerMajor } = CURRENCIES[currency];
  const asNumber = typeof value === "string" ? Number(value.trim()) : value;

  if (!Number.isFinite(asNumber)) {
    throw new Error(`Invalid money value: ${String(value)}`);
  }
  // Scale then round to nearest minor unit. Multiply as a fixed-point op.
  const minor = Math.round(asNumber * minorPerMajor);
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Money value out of safe integer range: ${String(value)}`);
  }
  return minor;
}

/** Convert integer minor units back to a major-unit number (display only). */
export function toMajorUnits(
  minor: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): number {
  assertInteger(minor);
  return minor / CURRENCIES[currency].minorPerMajor;
}

/** Format integer minor units as a localized currency string, e.g. "£42.50". */
export function formatMoney(
  minor: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  assertInteger(minor);
  const { locale } = CURRENCIES[currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(toMajorUnits(minor, currency));
}

export function currencySymbol(currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return CURRENCIES[currency].symbol;
}

/** Sum a list of integer minor-unit values safely. */
export function sumMinor(values: number[]): number {
  return values.reduce((acc, v) => {
    assertInteger(v);
    const next = acc + v;
    if (!Number.isSafeInteger(next)) {
      throw new Error("Money sum exceeded safe integer range");
    }
    return next;
  }, 0);
}

function assertInteger(minor: number): void {
  if (!Number.isInteger(minor)) {
    throw new Error(`Minor-unit money must be an integer, got: ${minor}`);
  }
}
