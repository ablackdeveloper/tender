import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import type { Appointment } from "@/features/care/types";

export type CalendarExportResult =
  "added" | "canceled" | "permission_denied" | "unavailable";

export async function exportAppointmentToCalendar(
  appointment: Appointment,
): Promise<CalendarExportResult> {
  if (Platform.OS === "web") return "unavailable";
  const permission = await Calendar.requestCalendarPermissions(Platform.OS === "ios");
  if (!permission.granted) return "permission_denied";
  const calendars =
    Platform.OS === "android"
      ? await Calendar.getCalendars(Calendar.EntityTypes.EVENT)
      : [];
  const calendar =
    Platform.OS === "ios"
      ? Calendar.getDefaultCalendarSync()
      : calendars.find((item) => item.allowsModifications && (item.isPrimary ?? true));
  if (!calendar) return "unavailable";
  const result = await calendar.addEventWithForm({
    endDate: appointment.endsAt
      ? new Date(appointment.endsAt)
      : new Date(new Date(appointment.startsAt).getTime() + 30 * 60_000),
    ...(appointment.location ? { location: appointment.location } : {}),
    notes: "User-recorded appointment exported from Flutterings.",
    startDate: new Date(appointment.startsAt),
    title: appointment.title,
  });
  return result.action === Calendar.CalendarDialogResultActions.saved
    ? "added"
    : "canceled";
}
