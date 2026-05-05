/**
 * Counts working days between two dates, excluding Saturdays and Sundays.
 * Both start and end dates are inclusive.
 */
export function countWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to midnight UTC to avoid timezone drift
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);

  if (start > end) return 0;

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getUTCDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

/**
 * Formats a date string to a readable format (e.g., "Monday, Jan 27, 2026")
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Gets today's date as YYYY-MM-DD string
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Returns all non-working days (Saturday/Sunday) between two dates inclusive.
 */
export function getNonWorkingDays(
  start: string,
  end: string
): { date: string; dayName: string }[] {
  const days: { date: string; dayName: string }[] = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const cur = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  while (cur <= endDate) {
    const d = cur.getUTCDay();
    if (d === 0 || d === 6) {
      days.push({ date: cur.toISOString().slice(0, 10), dayName: dayNames[d] });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}
