export type NotificationPreferences = {
  appointment: boolean;
  medicationAsRecorded: boolean;
  weeklyUpdate: boolean;
  photo: boolean;
  partnerRequest: boolean;
  revealingContent: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
};
