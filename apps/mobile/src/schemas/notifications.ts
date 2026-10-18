import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/u);

export const notificationScheduleSchema = z
  .object({
    quietHoursEnd: time.nullable(),
    quietHoursStart: time.nullable(),
    timezone: z.string().min(1).max(100),
  })
  .refine(
    (value) => (value.quietHoursStart === null) === (value.quietHoursEnd === null),
    { message: "Both quiet-hour times are required, or leave both empty." },
  )
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value.timezone }).format();
        return true;
      } catch {
        return false;
      }
    },
    { message: "Use a valid IANA timezone such as America/New_York." },
  );
