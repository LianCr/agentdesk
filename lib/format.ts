// Shared deterministic formatters. Templates and PDF validation both derive
// table cells from the structured values in products.json through these
// helpers, so no displayed number is maintained in two places.

export function usd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function intPercent(value: number): string {
  return `${value}%`;
}
