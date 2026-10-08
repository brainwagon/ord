// The pricing vocabulary the core and every page definition share. Pure; no
// imports, no DOM, no network.
//
// A Price (a rate, such as USD per 1M tokens or per image) and a Cost (USD for
// a Workload) have one shape:
//   {kind: 'usd', usd, note?}  a USD amount; `note`, when present, says how
//                              it was estimated (it isn't a price OpenRouter
//                              lists as such) and is shown on hover
//   {kind: 'reason', reason}   no amount; `reason` is one of REASONS

// Every reason a price or cost can be unavailable.
export const REASONS = Object.freeze({
  perToken: 'per-token pricing',     // billed by the token, not by the Workload's unit
  unpriced: 'unpriced',              // OpenRouter lists zero or no usable price, and it isn't a free offering
  unitUnclear: 'unit unclear',       // a price whose unit can't be pinned down
  variable: 'variable',              // the API's -1: a router, priced by what it picks
  notLoaded: 'pricing data not loaded',  // the extra source this page needs is missing
  byResolution: 'priced by resolution',  // the rate depends on a resolution the Workload doesn't set
});

const REASON_SET = new Set(Object.values(REASONS));

/** A Price or Cost giving no amount, for `key`, one of REASONS' keys. */
export const reason = key => {
  if (!REASONS[key]) throw new Error(`no such reason: ${key}`);
  return { kind: 'reason', reason: REASONS[key] };
};

/** A Price or Cost of `v` USD. */
export const usd = v => ({ kind: 'usd', usd: v });

/** Whether `p` is a well-formed Price or Cost. */
export const isPrice = p =>
  (p?.kind === 'usd' && Number.isFinite(p.usd) && p.usd >= 0) ||
  (p?.kind === 'reason' && REASON_SET.has(p.reason));

/**
 * USD rounded to 10 significant digits, which removes the float noise that
 * scaling OpenRouter's 15-digit per-unit prices adds (0.000266666666667/s ×
 * 3600 s is 0.96, not 0.9600000000012) and keeps every real digit.
 */
export const roundUsd = v => Number(v.toPrecision(10));

/**
 * An API price string (USD per unit) as a number, or null when it's missing
 * or not a number. -1 (variable) comes back as -1.
 */
export function parsePrice(s) {
  if (s === null || s === undefined || (typeof s === 'string' && s.trim() === '')) return null;
  const v = typeof s === 'number' || typeof s === 'string' ? Number(s) : NaN;
  return Number.isFinite(v) ? v : null;
}

/** Whether this Model id is a `:free` variant (OpenRouter's free offering). */
export const isFreeVariant = id => id.endsWith(':free');
