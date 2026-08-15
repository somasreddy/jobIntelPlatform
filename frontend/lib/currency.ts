/**
 * Currency / region formatting utilities — first step toward i18n.
 *
 * The backend already deals in multiple ISO 4217 currency codes (see
 * `backend/salary_prediction/predictor.py::_CURRENCY_MAP`,
 * `backend/job_discovery/service.py::currency_map`, and the `currency`
 * field on `Job`/`CandidateProfile`, which defaults to `"USD"` but is
 * confirmed to carry `"INR"` for India-tier roles and profiles). Today the
 * frontend renders those raw strings (e.g. `${job.currency} ${job.salaryMin}`)
 * with no locale-aware grouping or symbol handling.
 *
 * This module wraps the built-in `Intl.NumberFormat` — no new dependency —
 * behind a small, well-typed API so a later pass can swap ad-hoc string
 * interpolation for `formatCurrency` / `formatSalaryRange` on a
 * page-by-page basis.
 *
 * NOTE: this file is intentionally not imported anywhere yet. Wiring it
 * into `JobCard`, `jobs/[id]`, `applications`, etc. is a follow-up for
 * whoever owns each of those pages next.
 */

/** Formatting conventions for a currency this app knows about. */
export interface CurrencyInfo {
  /** ISO 4217 currency code, e.g. "USD". */
  code: string;
  /** Common display symbol, e.g. "$", "₹". */
  symbol: string;
  /** Human-readable name, for labels/selects. */
  name: string;
  /** Default BCP-47 locale used to format this currency's grouping/decimals
   *  (e.g. INR uses Indian digit grouping: 12,00,000 not 1,200,000). */
  locale: string;
  /** Default fraction digits for salary-scale amounts (whole-number pay
   *  figures don't need cents). Callers can override via `options`. */
  decimals: number;
}

/**
 * Currency codes this app has confirmed real usage for, keyed by ISO 4217
 * code. USD is the default for US-centric salary figures already in the
 * backend/mock data; INR is required because candidate profiles and
 * India-tier salary bands (`in_tier1`, "lpa" parsing in job discovery)
 * target India. GBP/EUR/AUD/CAD/SGD are included because the backend's
 * own currency maps (`predictor.py`, `service.py`) already emit them for
 * UK/EU/Australia/Canada/Singapore job postings — leaving them out would
 * just mean falling back to the generic formatter for data that already
 * exists today.
 */
export const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US", decimals: 0 },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN", decimals: 0 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE", decimals: 0 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB", decimals: 0 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU", decimals: 0 },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA", decimals: 0 },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG", decimals: 0 },
};

/** Matches the backend's default currency (`Job.currency`, `CandidateProfile.currency`). */
export const DEFAULT_CURRENCY = "USD";

/**
 * Look up known formatting conventions for a currency code. Falls back to
 * a generic entry (using the code itself as the symbol) for currencies not
 * in {@link CURRENCIES} rather than throwing, since job/profile data can in
 * principle carry any ISO code.
 */
export function getCurrencyInfo(currencyCode?: string | null): CurrencyInfo {
  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase();
  return (
    CURRENCIES[code] ?? {
      code,
      symbol: code,
      name: code,
      locale: "en-US",
      decimals: 0,
    }
  );
}

/** Optional overrides for {@link formatCurrency} beyond the currency's defaults. */
export interface FormatCurrencyOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Use compact notation, e.g. "$120K" instead of "$120,000". Default false. */
  compact?: boolean;
}

/**
 * Format a numeric amount as a locale-aware currency string using the
 * built-in `Intl.NumberFormat`.
 *
 * @param amount - the numeric amount. `null`/`undefined`/`NaN` render as an
 *   em dash ("—") rather than throwing, since salary fields are frequently
 *   undisclosed.
 * @param currencyCode - ISO 4217 code (defaults to {@link DEFAULT_CURRENCY}).
 *   Unrecognized codes still attempt `Intl.NumberFormat` formatting and fall
 *   back to a plain `symbol + grouped number` string if the runtime rejects
 *   the code (e.g. it isn't valid ISO 4217).
 * @param locale - BCP-47 locale to format with. Defaults to the currency's
 *   conventional locale (e.g. INR → "en-IN") rather than the caller's.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currencyCode: string = DEFAULT_CURRENCY,
  locale?: string,
  options?: FormatCurrencyOptions
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—"; // em dash — no figure to show
  }

  const info = getCurrencyInfo(currencyCode);
  const resolvedLocale = locale || info.locale;
  const minimumFractionDigits = options?.minimumFractionDigits ?? 0;
  const maximumFractionDigits = options?.maximumFractionDigits ?? info.decimals;

  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: "currency",
      currency: info.code,
      minimumFractionDigits,
      maximumFractionDigits: Math.max(minimumFractionDigits, maximumFractionDigits),
      notation: options?.compact ? "compact" : "standard",
    }).format(amount);
  } catch {
    // Intl.NumberFormat throws RangeError for currency codes it doesn't
    // recognize as valid ISO 4217. Fall back to a plain symbol + grouped
    // number so an unusual/unexpected code still renders something sane.
    const grouped = new Intl.NumberFormat(resolvedLocale, {
      minimumFractionDigits,
      maximumFractionDigits: Math.max(minimumFractionDigits, maximumFractionDigits),
    }).format(amount);
    return `${info.symbol}${grouped}`;
  }
}

/**
 * Format a min/max salary pair for display, e.g. "$120,000 – $180,000" or
 * "₹1,200,000 – ₹1,800,000". Handles the partial/undisclosed cases
 * that `Job.salaryMin`/`salaryMax` can carry in practice (see
 * `backend/api/jobs.py`, `backend/models/database.py` — both nullable):
 *
 * - both min and max present and different → a range
 * - both present and equal → a single figure
 * - only one of min/max present → "From X" / "Up to X"
 * - neither present → "Not disclosed"
 *
 * This is the convenience helper for the app's most common currency
 * display case; use {@link formatCurrency} directly for single amounts.
 */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currencyCode: string = DEFAULT_CURRENCY,
  locale?: string
): string {
  const hasMin = typeof min === "number" && !Number.isNaN(min);
  const hasMax = typeof max === "number" && !Number.isNaN(max);

  if (!hasMin && !hasMax) {
    return "Not disclosed";
  }
  if (hasMin && hasMax && min === max) {
    return formatCurrency(min, currencyCode, locale);
  }
  if (hasMin && hasMax) {
    return `${formatCurrency(min, currencyCode, locale)} – ${formatCurrency(max, currencyCode, locale)}`;
  }
  if (hasMin) {
    return `From ${formatCurrency(min, currencyCode, locale)}`;
  }
  return `Up to ${formatCurrency(max, currencyCode, locale)}`;
}
