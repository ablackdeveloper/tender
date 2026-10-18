import {
  notificationCategories,
  notificationCopy,
} from "@/services/notifications/notification-copy";

describe("notificationCopy", () => {
  it.each(notificationCategories)("keeps %s generic by default", (category) => {
    expect(notificationCopy(category, false)).toEqual({
      body: "You have an update in Tender.",
      title: "Tender reminder",
    });
  });

  it("uses pregnancy-revealing copy only after explicit opt-in", () => {
    expect(notificationCopy("weekly_update", true).body).toContain("pregnancy");
    expect(notificationCopy("weekly_update", false).body).not.toContain("pregnancy");
  });

  it("describes medication as a record reminder, not an instruction", () => {
    const body = notificationCopy("medication_as_recorded", true).body.toLowerCase();
    expect(body).toContain("record");
    expect(body).not.toMatch(/\b(take|stop|change|dose)\b/u);
  });
});
