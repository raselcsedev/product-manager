import { money } from "@/lib/format";

// Optional currency code shown in front of amounts (set NEXT_PUBLIC_CURRENCY, for example BDT)
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "";

export const formatMoney = (amount: number) => (CURRENCY ? `${CURRENCY} ` : "") + money(amount);

// Money maths in whole cents avoids the classic 0.1 + 0.2 = 0.30000000000000004 problem.
export const toCents = (amount: number) => Math.round(amount * 100);
export const fromCents = (cents: number) => cents / 100;

export type RangeKey = "today" | "yesterday" | "7d" | "month" | "all";

export const rangeLabels: Record<RangeKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  month: "This month",
  all: "All time",
};

// "Today" means the seller's own today (their time zone), turned into exact moments for the server.
export function rangeFor(key: RangeKey): { from?: string; to?: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (offset: number) =>
    new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + offset);

  switch (key) {
    case "today":
      return { from: startOfToday.toISOString(), to: day(1).toISOString() };
    case "yesterday":
      return { from: day(-1).toISOString(), to: startOfToday.toISOString() };
    case "7d":
      return { from: day(-6).toISOString(), to: day(1).toISOString() };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: day(1).toISOString() };
    default:
      return {};
  }
}
