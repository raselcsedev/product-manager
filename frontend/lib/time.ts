// The server sends UTC times. If one arrives without a time zone ("2026-10-14T05:12:03"),
// the browser would treat it as LOCAL time and show it hours off, so we mark it as UTC first.
export function parseUtc(iso: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
}

// "just now", "5 minutes ago", "yesterday", "3 days ago", or a date for anything older than a month
export function timeAgo(iso: string): string {
  const date = parseUtc(iso);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000); // negative = in the past
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  return date.toLocaleDateString();
}

// Full date and time in the viewer's own time zone (shown as a tooltip)
export const formatFull = (iso: string) => parseUtc(iso).toLocaleString();
