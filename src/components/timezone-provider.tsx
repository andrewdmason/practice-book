"use client";

import { useEffect } from "react";

/**
 * Sets a `tz` cookie with the user's IANA timezone so server actions
 * can compute dates in the user's local timezone instead of UTC.
 */
export function TimezoneProvider() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && document.cookie.indexOf(`tz=${tz}`) === -1) {
      document.cookie = `tz=${tz};path=/;max-age=31536000;SameSite=Lax`;
    }
  }, []);

  return null;
}
