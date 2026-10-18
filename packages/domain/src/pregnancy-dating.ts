const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const millisecondsPerDay = 86_400_000;
const gestationDays = 280;

export type CalendarDate = `${number}-${number}-${number}`;
export type DueDateSource =
  "clinician" | "ivf" | "lmp" | "manual" | "ultrasound";
export type PregnancyState = "active" | "ended";

export type PregnancyDatingInput = {
  clinicianDueDate?: string | null;
  endedAt?: Date | string | null;
  estimatedDueDate?: string | null;
  lmpDate?: string | null;
  now: Date;
  timezone: string;
};

export type GestationalAge = {
  days: number;
  totalDays: number;
  weeks: number;
};

export type PregnancyDatingResult = {
  activeDueDate: CalendarDate | null;
  asOfDate: CalendarDate;
  gestationalAge: GestationalAge | null;
  modelStartDate: CalendarDate | null;
  source: DueDateSource | "unknown";
  state: PregnancyState;
};

function parseCalendarDate(value: string): number {
  const match = calendarDatePattern.exec(value);
  if (!match) throw new Error(`Invalid calendar date: ${value}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  return timestamp;
}

function toCalendarDate(timestamp: number): CalendarDate {
  return new Date(timestamp).toISOString().slice(0, 10) as CalendarDate;
}

export function addCalendarDays(value: string, days: number): CalendarDate {
  if (!Number.isInteger(days))
    throw new Error("Calendar-day offset must be an integer.");
  return toCalendarDate(parseCalendarDate(value) + days * millisecondsPerDay);
}

export function initialEstimatedDueDateFromLmp(lmpDate: string): CalendarDate {
  return addCalendarDays(lmpDate, gestationDays);
}

export function calendarDateInTimeZone(
  instant: Date,
  timezone: string,
): CalendarDate {
  if (Number.isNaN(instant.getTime())) throw new Error("Invalid instant.");

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}` as CalendarDate;
}

export function calendarDayDifference(later: string, earlier: string): number {
  return (
    (parseCalendarDate(later) - parseCalendarDate(earlier)) / millisecondsPerDay
  );
}

function resolveAsOfDate(input: PregnancyDatingInput): {
  asOfDate: CalendarDate;
  state: PregnancyState;
} {
  if (input.endedAt) {
    const endedAt =
      input.endedAt instanceof Date ? input.endedAt : new Date(input.endedAt);
    return {
      asOfDate: calendarDateInTimeZone(endedAt, input.timezone),
      state: "ended",
    };
  }

  return {
    asOfDate: calendarDateInTimeZone(input.now, input.timezone),
    state: "active",
  };
}

export function derivePregnancyDating(
  input: PregnancyDatingInput,
): PregnancyDatingResult {
  const { asOfDate, state } = resolveAsOfDate(input);
  const clinicianDueDate = input.clinicianDueDate
    ? toCalendarDate(parseCalendarDate(input.clinicianDueDate))
    : null;
  const estimatedDueDate = input.estimatedDueDate
    ? toCalendarDate(parseCalendarDate(input.estimatedDueDate))
    : null;
  const lmpDate = input.lmpDate
    ? toCalendarDate(parseCalendarDate(input.lmpDate))
    : null;
  const activeDueDate =
    clinicianDueDate ??
    estimatedDueDate ??
    (lmpDate ? initialEstimatedDueDateFromLmp(lmpDate) : null);
  const source: PregnancyDatingResult["source"] = clinicianDueDate
    ? "clinician"
    : estimatedDueDate
      ? "manual"
      : lmpDate
        ? "lmp"
        : "unknown";
  const modelStartDate = activeDueDate
    ? addCalendarDays(activeDueDate, -gestationDays)
    : lmpDate;

  if (!modelStartDate) {
    return {
      activeDueDate,
      asOfDate,
      gestationalAge: null,
      modelStartDate: null,
      source,
      state,
    };
  }

  const totalDays = calendarDayDifference(asOfDate, modelStartDate);
  return {
    activeDueDate,
    asOfDate,
    gestationalAge: {
      days: ((totalDays % 7) + 7) % 7,
      totalDays,
      weeks: Math.floor(totalDays / 7),
    },
    modelStartDate,
    source,
    state,
  };
}
