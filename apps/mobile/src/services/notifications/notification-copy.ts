export const notificationCategories = [
  "appointment",
  "medication_as_recorded",
  "weekly_update",
  "photo",
  "partner_request",
] as const;

export type NotificationCategory = (typeof notificationCategories)[number];

const revealingCopy: Record<NotificationCategory, string> = {
  appointment: "An appointment reminder is ready.",
  medication_as_recorded: "A medication record reminder is ready.",
  weekly_update: "Your weekly pregnancy update is ready.",
  photo: "A pregnancy photo reminder is ready.",
  partner_request: "A partner request is ready.",
};

export function notificationCopy(category: NotificationCategory, revealing: boolean) {
  return {
    title: "Flutterings reminder",
    body: revealing ? revealingCopy[category] : "You have an update in Flutterings.",
  } as const;
}
