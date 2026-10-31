// Money and dates for the UI. Money from the API is always whole taka (integers).

// English UI uses Bangladeshi lakh grouping (en-IN pattern): 1,50,000.
// Bangla UI (later) uses Bangla digits: ৳১,৫০,০০০.
const NUMBER_LOCALE: Record<string, string> = { en: "en-IN", bn: "bn-BD" };

const numberFormatters = new Map<string, Intl.NumberFormat>();

function numberFormatter(locale: string): Intl.NumberFormat {
  const key = NUMBER_LOCALE[locale] ?? "en-IN";
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(key, { maximumFractionDigits: 0 });
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

/** 38500 -> "৳38,500", 150000 -> "৳1,50,000", -500 -> "−৳500". */
export function formatTaka(amount: number, locale = "en"): string {
  if (!Number.isFinite(amount)) return "৳–";
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "−" : "";
  return `${sign}৳${numberFormatter(locale).format(Math.abs(rounded))}`;
}

/** Calendar date in Dhaka time: "31 Oct 2026". */
export function formatDate(value: string | Date, locale = "en"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}