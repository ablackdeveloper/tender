import assert from "node:assert/strict";

export const androidScenarioCount = 11;
const visible = (text) => ({
  extendedWaitUntil: { visible: text, timeout: 30000 },
});
const tap = (text) => ({ tapOn: text });
const link = (route) => ({ androidOpenLink: `tender://${route}` });
const scroll = (element, direction = "DOWN") => ({
  scrollUntilVisible: {
    element,
    direction,
    timeout: 30000,
    centerElement: true,
  },
});
const id = (label) =>
  `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const fill = (label, value) => [
  scroll({ id: id(label) }),
  { tapOn: { id: id(label) } },
  { eraseText: 2000 },
  { inputText: value },
  { hideKeyboard: {} },
];
async function rows(c, table) {
  const result = await c.stack.admin
    .from(table)
    .select("*")
    .eq("owner_id", c.user.id);
  assert.ifError(result.error);
  return result.data;
}
async function one(c, table) {
  const result = await rows(c, table);
  assert.equal(result.length, 1, `Expected one owned ${table} record`);
  return result[0];
}
async function waitForStatus(c, table, status) {
  const deadline = Date.now() + 15000;
  do {
    const row = await one(c, table);
    if (row.lifecycle_status === status) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  assert.fail(`The saved ${table} status did not become ${status}`);
}
async function reopen(c, route, marker) {
  await c.ui([
    { stopApp: {} },
    { launchApp: { clearState: false } },
    visible("Today"),
    link(route),
    visible(marker),
  ]);
}

// These cases use the same fresh-account, package reset, inbox and final cleanup
// gates as the original native suite. Database reads verify UI writes; they never
// replace the production app's save operation.
export async function runAndroidFlows({ scenario, login }) {
  await scenario("android-navigation-and-secondary-routes", async (c) => {
    await login(c);
    for (const [route, marker] of [
      ["journey", "Journey"],
      ["care", "Keep care details together"],
      ["memories", "Add a memory"],
      ["together", "What would help right now\\?"],
      ["add", "Today preferences"],
      ["planning", "Projects and tasks"],
      ["care/summary", "Generate selected summary"],
      ["recovery", "Recovery space is optional"],
      ["memory-capsule", "This week's moments"],
      ["meals", "Log a meal"],
      ["journal", "Add a memory"],
      ["get-help", "Get help"],
      ["health-data", "Not active yet"],
    ]) {
      await c.ui([link(route), scroll(marker), visible(marker)]);
    }
    await c.ui([link(""), visible("Today")]);
  });

  await scenario("android-invalid-editor-links", async (c) => {
    await login(c);
    for (const [route, marker] of [
      ["meals/bad-id", "Meal unavailable"],
      ["journal/bad-id", "Unable to open entry"],
    ]) {
      await c.ui([
        link(route),
        visible(marker),
        { assertNotVisible: { id: id("Entry") } },
        link(""),
        visible("Today"),
      ]);
    }
  });

  await scenario("android-checkin-save-and-reopen", async (c) => {
    await login(c);
    await c.ui([
      link("check-in"),
      visible("Complete check-in"),
      ...fill("Private note", "Native checkin note"),
      tap("Complete check-in"),
      visible("Today"),
    ]);
    const saved = await one(c, "daily_checkins");
    assert.equal(saved.note, "Native checkin note");
    assert.ok(saved.completed_at);
    await reopen(c, "check-in", "Complete check-in");
    await c.ui([scroll("Native checkin note"), visible("Native checkin note")]);
    assert.equal((await one(c, "daily_checkins")).id, saved.id);
  });

  await scenario("android-meal-save-edit-and-reopen", async (c) => {
    await login(c);
    await c.ui([
      tap("Add"),
      visible("Meal"),
      tap("Meal"),
      ...fill("Ingredients", "Rice, beans"),
      ...fill("Notes", "Native meal note"),
      scroll("Saved"),
      visible("Saved"),
    ]);
    const saved = await one(c, "meals");
    assert.equal(saved.notes, "Native meal note");
    await reopen(c, `meals/${saved.id}`, "Ingredients");
    await c.ui([
      ...fill("Notes", "Native meal edited"),
      scroll("Saved"),
      visible("Saved"),
    ]);
    assert.equal((await one(c, "meals")).notes, "Native meal edited");
    await reopen(c, `meals/${saved.id}`, "Ingredients");
    await c.ui([scroll("Native meal edited"), visible("Native meal edited")]);
  });

  await scenario("android-journal-save-edit-delete", async (c) => {
    await login(c);
    await c.ui([
      link("journal/new"),
      ...fill("Title (optional)", "Native private memory"),
      ...fill("Entry", "Native private body"),
      scroll("Save now"),
      tap("Save now"),
      scroll("Saved", "UP"),
      visible("Saved"),
    ]);
    const saved = await one(c, "journal_entries");
    assert.equal(saved.body, "Native private body");
    assert.equal(saved.privacy_level, "private");
    await reopen(c, `journal/${saved.id}`, "Native private memory");
    await c.ui([
      ...fill("Entry", "Native edited body"),
      scroll("Save now"),
      tap("Save now"),
      scroll("Saved", "UP"),
      visible("Saved"),
    ]);
    assert.equal((await one(c, "journal_entries")).body, "Native edited body");
    await c.ui([
      scroll("Permanently delete entry"),
      tap("Permanently delete entry"),
      visible("Delete journal entry.*"),
      tap("Cancel"),
    ]);
    assert.equal((await one(c, "journal_entries")).id, saved.id);
    await c.ui([
      tap("Permanently delete entry"),
      tap("Delete permanently"),
      visible("Add a memory"),
    ]);
    assert.equal((await rows(c, "journal_entries")).length, 0);
  });

  await scenario("android-care-provider-save-delete", async (c) => {
    await login(c);
    await c.ui([
      link("care"),
      tap("Care team"),
      ...fill("Provider name", "Native provider"),
      ...fill("Phone", "+12025550123"),
      scroll("Add provider record"),
      tap("Add provider record"),
      scroll("Native provider", "UP"),
      visible("Native provider"),
    ]);
    assert.equal((await one(c, "providers")).name, "Native provider");
    await reopen(c, "care", "Keep care details together");
    await c.ui([
      tap("Care team"),
      scroll("Delete provider record"),
      tap("Delete provider record"),
      tap("Cancel"),
    ]);
    assert.equal((await rows(c, "providers")).length, 1);
    await c.ui([
      tap("Delete provider record"),
      tap("Permanently delete record"),
      visible("No providers recorded."),
    ]);
    assert.equal((await rows(c, "providers")).length, 0);
  });

  await scenario("android-planning-task-and-support", async (c) => {
    await login(c);
    await c.ui([
      link("planning"),
      ...fill("New project", "Native plan"),
      scroll("Add project"),
      tap("Add project"),
      ...fill("New task in Native plan", "Native task"),
      tap("Add task"),
      scroll("Native task", "UP"),
      visible("Native task"),
      tap("Mark complete"),
      visible("Completed.*Native task"),
    ]);
    assert.equal((await one(c, "tasks")).status, "completed");
    await c.ui([
      tap("Reopen task"),
      visible("Mark complete"),
      tap("Remove from plan"),
      scroll("Show removed tasks", "UP"),
      tap("Show removed tasks"),
      scroll("Restore task"),
      tap("Restore task"),
      visible("Mark complete"),
    ]);
    assert.equal((await one(c, "tasks")).status, "open");
    await c.ui([
      ...fill("New support request", "Native private request"),
      tap("Add support request"),
      scroll("Native private request.*", "UP"),
      visible("Native private request.*"),
      tap("Cancel request"),
      visible("Native private request.*cancelled"),
    ]);
    assert.equal((await one(c, "support_requests")).status, "cancelled");
    await reopen(c, "planning", "Projects and tasks");
    await c.ui([
      scroll("Native plan"),
      visible("Native plan"),
      scroll("Native task"),
      visible("Native task"),
    ]);
  });

  await scenario("android-question-draft-restart", async (c) => {
    await login(c);
    await c.ui([
      link("appointment-question"),
      visible("No upcoming appointment"),
      ...fill("Question", "Native question draft"),
      scroll("Question draft saved on this device.", "UP"),
      visible("Question draft saved on this device."),
    ]);
    await reopen(c, "appointment-question", "No upcoming appointment");
    await c.ui([
      scroll("Native question draft"),
      visible("Native question draft"),
      { assertVisible: { text: "Save question", enabled: false } },
    ]);
    assert.equal((await rows(c, "appointment_questions")).length, 0);
  });

  await scenario("android-notification-validation-and-save", async (c) => {
    await login(c);
    await c.ui([
      link("notification-settings"),
      ...fill("Start (24-hour HH:MM)", "99:99"),
      scroll("Save choices"),
      tap("Save choices"),
      scroll("Settings not saved", "UP"),
      visible("Settings not saved"),
    ]);
    const before = await rows(c, "notification_preferences");
    assert.ok(before.every((row) => row.quiet_hours_start !== "99:99"));
    await c.ui([
      ...fill("Start (24-hour HH:MM)", "21:30"),
      ...fill("End (24-hour HH:MM)", "08:00"),
      scroll("Save choices"),
      tap("Save choices"),
      scroll("Notification choices saved.", "UP"),
      visible("Notification choices saved."),
    ]);
    const saved = await one(c, "notification_preferences");
    assert.match(saved.quiet_hours_start, /^21:30/);
    assert.equal(saved.revealing_content_enabled, false);
    await reopen(c, "notification-settings", "Notifications");
    await c.ui([scroll("21:30"), visible("21:30")]);
  });

  await scenario("android-pregnancy-pause-and-restore", async (c) => {
    await login(c);
    await c.ui([
      link("pregnancy-settings"),
      scroll("Paused"),
      tap("Paused"),
      scroll("Save pregnancy settings"),
      tap("Save pregnancy settings"),
    ]);
    await waitForStatus(c, "pregnancy_experience_settings", "paused");
    await reopen(c, "pregnancy-settings", "Pregnancy settings");
    assert.equal(
      (await one(c, "pregnancy_experience_settings")).lifecycle_status,
      "paused",
    );
    await c.ui([
      scroll("Active"),
      tap("Active"),
      scroll("Save pregnancy settings"),
      tap("Save pregnancy settings"),
    ]);
    await waitForStatus(c, "pregnancy_experience_settings", "active");
    await reopen(c, "pregnancy-settings", "Pregnancy settings");
    assert.equal(
      (await one(c, "pregnancy_experience_settings")).lifecycle_status,
      "active",
    );
  });

  await scenario("android-invitation-short-token-guard", async (c) => {
    await login(c);
    const before = (await rows(c, "pregnancy_members"))
      .map((row) => row.id)
      .sort();
    await c.ui([
      link("partner-invitation"),
      visible("Partner invitation"),
      ...fill("Invitation token", "invalid"),
      { assertVisible: { text: "Accept invitation", enabled: false } },
      { assertVisible: { text: "Decline invitation", enabled: false } },
    ]);
    assert.deepEqual(
      (await rows(c, "pregnancy_members")).map((row) => row.id).sort(),
      before,
    );
  });
}
