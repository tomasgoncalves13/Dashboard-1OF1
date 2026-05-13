import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(
  value: number | string | null | undefined,
  currency = "EUR",
  locale = "pt-PT",
) {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
}

export function formatNumber(value: number | null | undefined, locale = "pt-PT") {
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}
