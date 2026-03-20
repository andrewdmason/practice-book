/**
 * Returns today's date as YYYY-MM-DD in the user's local timezone.
 * Use this instead of `new Date().toISOString().slice(0, 10)` which gives UTC.
 */
export function localDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
