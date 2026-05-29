/**
 * Returns a date as YYYY-MM-DD in the given timezone (or the runtime's local timezone).
 *
 * On the server (Vercel), the runtime timezone is UTC — pass the user's IANA
 * timezone (e.g. "America/Los_Angeles") to get the correct local date.
 * On the client the default is already the user's timezone so no argument is needed.
 */
export function localDate(date: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    // Intl gives us locale-independent numeric parts in the target timezone
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * A human "right now" stamp in the given timezone, e.g.
 * "Thursday, May 29, 2026 at 8:25 AM PDT". Gives the interviewer a real
 * time-of-day anchor so it can tell a 5pm event apart from a past one.
 */
export function formatNow(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

/**
 * Read the user's IANA timezone from the `tz` cookie (set by TimezoneProvider).
 * Only call from server code — uses `next/headers`.
 */
export async function getUserTimezone(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return jar.get("tz")?.value ?? "UTC";
}
