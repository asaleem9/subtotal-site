// Port of SubtotalShared/Models/BillingCycle.swift. Everything is integer cents so the
// receipt never shows float drift. Rounding is half-even, like Decimal's bankers rounding.
export const CYCLES = ["weekly", "monthly", "quarterly", "yearly", "custom"];

export function toCents(price) { return Math.round(Number(price) * 100); }

function roundHalfEven(x) {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export function yearlyCents(amountCents, cycle, customMonths = 1) {
  switch (cycle) {
    case "weekly": return amountCents * 52;
    case "monthly": return amountCents * 12;
    case "quarterly": return amountCents * 4;
    case "yearly": return amountCents;
    case "custom": return roundHalfEven((amountCents * 12) / Math.max(1, customMonths));
    default: return amountCents * 12;
  }
}

export function monthlyCents(amountCents, cycle, customMonths = 1) {
  if (cycle === "monthly") return amountCents;
  return roundHalfEven(yearlyCents(amountCents, cycle, customMonths) / 12);
}

export function suffix(cycle, customMonths = 1) {
  switch (cycle) {
    case "weekly": return "/wk";
    case "monthly": return "/mo";
    case "quarterly": return "/qtr";
    case "yearly": return "/yr";
    case "custom": return customMonths % 12 === 0 ? `/${customMonths / 12} yrs` : `/${customMonths} mo`;
    default: return "";
  }
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export function formatCents(cents) { return usd.format(cents / 100); }
