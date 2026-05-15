import { localDate, getUserTimezone } from "@/lib/date-utils";

export async function todayLocal(): Promise<string> {
  const tz = await getUserTimezone();
  return localDate(new Date(), tz);
}
