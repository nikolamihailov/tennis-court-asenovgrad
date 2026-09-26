/**
 * Time helpers.
 *
 * The club is in Asenovgrad, so every hour a human types or reads is Europe/Sofia local
 * time, while the database stores UTC `timestamptz`. Bulgaria observes DST, so the offset
 * is +02:00 or +03:00 depending on the date — it cannot be hardcoded.
 *
 * These helpers use the built-in Intl time zone database rather than a date library, so
 * there is no dependency to keep current.
 */

export const CLUB_TIME_ZONE = "Europe/Sofia";

/** Offset of `timeZone` from UTC, in milliseconds, at the given instant. */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }

  // `hour` comes back as 24 for midnight in some ICU versions.
  const hour = parts.hour === 24 ? 0 : parts.hour;

  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    hour,
    parts.minute,
    parts.second,
  );

  return asIfUtc - instant.getTime();
}

/**
 * Convert a wall-clock time in the club's time zone into a UTC instant.
 *
 * The offset depends on the instant we are trying to find, so this resolves in two
 * passes: guess using the offset at the naive timestamp, then re-check the offset at
 * the corrected instant. The second pass only changes anything within an hour of a DST
 * transition, which is exactly when a single pass would be wrong.
 */
export function clubTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);

  const firstOffset = timeZoneOffsetMs(new Date(naive), CLUB_TIME_ZONE);
  let instant = naive - firstOffset;

  const secondOffset = timeZoneOffsetMs(new Date(instant), CLUB_TIME_ZONE);
  if (secondOffset !== firstOffset) instant = naive - secondOffset;

  return new Date(instant);
}

/** Parse an ISO `YYYY-MM-DD` date plus an hour into a UTC instant. */
export function clubDateHourToUtc(isoDate: string, hour: number): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return clubTimeToUtc(year, month, day, hour);
}

/** Parse an ISO `YYYY-MM-DD` date plus minutes since club-local midnight into a UTC instant. */
export function clubDateMinuteToUtc(isoDate: string, minuteOfDay: number): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return clubTimeToUtc(year, month, day, Math.floor(minuteOfDay / 60), minuteOfDay % 60);
}

/** `HH:MM` for a number of minutes since midnight, e.g. 570 -> "09:30". */
export function formatMinuteOfDay(minuteOfDay: number): string {
  const wrapped = ((minuteOfDay % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** The club-local calendar parts of a UTC instant. */
export function clubDateParts(instant: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
  };
}

/** `YYYY-MM-DD` for an instant, in club-local time. */
export function toClubIsoDate(instant: Date): string {
  const { year, month, day } = clubDateParts(instant);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Today's date in the club's time zone, as `YYYY-MM-DD`. */
export function clubToday(): string {
  return toClubIsoDate(new Date());
}

/** `HH:MM` for an instant, in club-local time. */
export function formatClubTime(instant: Date): string {
  const { hour, minute } = clubDateParts(instant);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const BG_DATE = new Intl.DateTimeFormat("bg-BG", {
  timeZone: CLUB_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const BG_DATE_SHORT = new Intl.DateTimeFormat("bg-BG", {
  timeZone: CLUB_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const BG_WEEKDAY = new Intl.DateTimeFormat("bg-BG", {
  timeZone: CLUB_TIME_ZONE,
  weekday: "long",
});

/** e.g. "1 октомври 2026 г." */
export function formatClubDateLong(instant: Date): string {
  return BG_DATE.format(instant);
}

/** e.g. "01.10.2026" */
export function formatClubDateShort(instant: Date): string {
  return BG_DATE_SHORT.format(instant);
}

/** e.g. "четвъртък" */
export function formatClubWeekday(instant: Date): string {
  return BG_WEEKDAY.format(instant);
}

/** e.g. "01.10.2026, 10:00 – 11:00" */
export function formatClubRange(startsAt: Date, endsAt: Date): string {
  return `${formatClubDateShort(startsAt)}, ${formatClubTime(startsAt)} – ${formatClubTime(endsAt)}`;
}

/** Add whole days to a `YYYY-MM-DD` string, staying in the calendar domain. */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

/** True when `isoDate` looks like a calendar date and is a real day. */
export function isValidIsoDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const [year, month, day] = isoDate.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}
