import assert from "node:assert/strict";
import { createHarness } from "./harness.mjs";
const harness = await createHarness("core");
const { scenario, url } = harness;
let failure;
try {
  const chips = new Set([
    "Hospital bag",
    "Birth preferences",
    "Support at home",
    "Support after birth",
    "Exclude item 2",
    "Fixture follow-up",
    "First visit",
    "If time",
  ]);
  const button = (page, name) =>
    page.getByRole(chips.has(name) ? "checkbox" : "button", {
      name,
      exact: true,
    });
  await scenario("planning-save-edit-restore", "", async (page) => {
    await button(page, "Hospital bag").click();
    await page
      .getByRole("textbox", { name: "Item 1", exact: true })
      .fill("My own packing item");
    await button(page, "Exclude item 2").click();
    await button(page, "Save selected tasks").click();
    await page.getByText("Your plan is saved.", { exact: false }).waitFor();
    let state = await page.evaluate(() => window.fixture);
    assert.equal(state.projects.length, 1);
    assert.equal(state.tasks.length, 4);
    assert.equal(state.tasks[0].title, "My own packing item");
    await button(page, "Edit task").first().click();
    await page
      .getByRole("textbox", { name: "Task title", exact: true })
      .fill("Updated packing item");
    await button(page, "Save task title").click();
    await page.getByText("Updated packing item", { exact: true }).waitFor();
    await button(page, "Mark complete").first().click();
    await page
      .getByText("Completed · Updated packing item", { exact: true })
      .waitFor();
    await button(page, "Remove from plan").first().click();
    await page
      .getByText("Completed · Updated packing item", { exact: true })
      .waitFor({ state: "hidden" });
    await button(page, "Show removed tasks").click();
    await button(page, "Restore task").click();
    await page.getByText("Updated packing item", { exact: true }).waitFor();
    await button(page, "Support at home").click();
    await button(page, "Save selected tasks").click();
    await page
      .getByRole("textbox", {
        name: "New task in Support at home",
        exact: true,
      })
      .fill("Extra home task");
    await button(page, "Add task").click();
    await page.getByText("Extra home task", { exact: true }).waitFor();
    state = await page.evaluate(() => window.fixture);
    assert.equal(
      state.tasks.find((t) => t.title === "Extra home task").projectId,
      state.projects[1].id,
    );
  });
  await scenario("planning-failure-and-retry", "", async (page) => {
    await button(page, "Birth preferences").click();
    await page
      .getByRole("textbox", { name: "Item 1", exact: true })
      .fill("Keep my words");
    await page.evaluate(() => {
      window.fixture.failNext = true;
    });
    await button(page, "Save selected tasks").click();
    await page
      .getByText("The plan could not be saved.", { exact: false })
      .waitFor();
    assert.equal(
      await page
        .getByRole("textbox", { name: "Item 1", exact: true })
        .inputValue(),
      "Keep my words",
    );
    await button(page, "Save selected tasks").click();
    await page.getByText("Your plan is saved.", { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => window.fixture.projects.length), 1);
  });
  await scenario("planning-offline", "offline=1", async (page) => {
    await button(page, "Hospital bag").click();
    assert.equal(await button(page, "Save selected tasks").isDisabled(), true);
    assert.equal(await page.evaluate(() => window.fixture.projects.length), 0);
  });
  await scenario(
    "recovery-plan-template",
    "template=after-birth",
    async (page) => {
      await page
        .getByRole("textbox", { name: "Plan title", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("textbox", { name: "Plan title", exact: true })
          .inputValue(),
        "Support after birth",
      );
      assert.equal(
        await page.evaluate(() => window.fixture.projects.length),
        0,
        "opening a template does not save it",
      );
      await button(page, "Save selected tasks").click();
      await page.getByText("Your plan is saved.", { exact: false }).waitFor();
      assert.equal(await page.evaluate(() => window.fixture.tasks.length), 5);
    },
  );
  await scenario(
    "question-prompts-and-reading",
    "screen=questions&article=fixture-article",
    async (page) => {
      await button(page, "Fixture follow-up").click();
      await page
        .getByRole("textbox", { name: "Question", exact: true })
        .fill("My existing question.");
      await button(page, "First visit").click();
      await button(
        page,
        "Who should I contact with questions between visits?",
      ).click();
      await button(page, "Use this reading as a starting point").click();
      await button(page, "If time").click();
      await page.evaluate(() => {
        window.fixture.failNext = true;
      });
      await button(page, "Save question").click();
      await page.getByText("Question not saved", { exact: true }).waitFor();
      assert.match(
        await page
          .getByRole("textbox", { name: "Question", exact: true })
          .inputValue(),
        /^My existing question\./,
      );
      await button(page, "Save question").click();
      await page.waitForFunction(() => window.fixture.routes.length === 1);
      const state = await page.evaluate(() => window.fixture);
      assert.equal(state.questions.length, 1);
      assert.match(
        state.questions[0].text,
        /My existing question\.[\s\S]*Who should I contact[\s\S]*Synthetic reviewed reading/,
      );
      assert.equal(state.questions[0].priority, 2);
      assert.equal(state.questions[0].appointmentId, "synthetic-visit");
      assert.equal(state.routes[0], "/(app)/care");
    },
  );
  await scenario(
    "question-without-appointment",
    "screen=questions&noAppointment=1",
    async (page) => {
      await page
        .getByText("No upcoming appointment", { exact: true })
        .waitFor();
      assert.equal(await button(page, "Save question").isDisabled(), true);
      await button(page, "Open Care").click();
      assert.equal(
        await page.evaluate(() => window.fixture.routes[0]),
        "/(app)/care",
      );
    },
  );
  await scenario(
    "question-offline",
    "screen=questions&offline=1",
    async (page) => {
      await button(page, "Fixture follow-up").click();
      await page
        .getByRole("textbox", { name: "Question", exact: true })
        .fill("Offline thought");
      assert.equal(await button(page, "Save question").isDisabled(), true);
    },
  );
  await scenario("recovery-actions", "screen=recovery", async (page) => {
    for (const name of [
      "Prepare a question",
      "Build my support plan",
      "Ask for practical help",
      "Write a private reflection",
      "Open my memories",
    ]) {
      await button(page, name).click();
      await page.waitForURL(
        (address) => address.searchParams.get("screen") !== "recovery",
      );
      await button(page, "← Back").click();
      await page
        .getByRole("heading", { name: "Support after birth", exact: true })
        .waitFor();
    }
    assert.deepEqual(await page.evaluate(() => window.fixture.routes), [
      "/(app)/appointment-question",
      { pathname: "/(app)/planning", params: { template: "after-birth" } },
      "/(app)/together",
      {
        pathname: "/(app)/journal/[entryId]",
        params: { entryId: "new", reflection: "recovery" },
      },
      "/(app)/memories",
    ]);
    await page
      .getByText("No reviewed resources are available for this setting yet.", {
        exact: true,
      })
      .waitFor();
  });
  await scenario(
    "recovery-optional",
    "screen=recovery&disabledRecovery=1",
    async (page) => {
      await page
        .getByText("Recovery space is optional", { exact: true })
        .waitFor();
      assert.equal(await button(page, "Write a private reflection").count(), 0);
      await button(page, "Pregnancy settings").click();
      assert.equal(
        await page.evaluate(() => window.fixture.routes[0]),
        "/(app)/pregnancy-settings",
      );
    },
  );
  await scenario(
    "recovery-no-appointment",
    "screen=recovery&noAppointment=1",
    async (page) => {
      await button(page, "Open appointments").click();
      assert.equal(
        await page.evaluate(() => window.fixture.routes[0]),
        "/(app)/care",
      );
    },
  );
  await scenario(
    "navigation-reading-to-saved-question",
    "screen=journey",
    async (page) => {
      await button(page, "Save a question for my visit").click();
      await page.waitForURL(
        (address) => address.searchParams.get("article") === "fixture-article",
      );
      await button(page, "Fixture follow-up").click();
      await button(page, "Use this reading as a starting point").click();
      await button(page, "Save question").click();
      await button(page, "Add one question").waitFor();
      await page
        .getByText('I read "Synthetic reviewed reading"', { exact: false })
        .first()
        .waitFor();
      await page.goBack();
      await page
        .getByRole("heading", { name: "Journey", exact: true })
        .waitFor();
      await page.goForward();
      await button(page, "Add one question").waitFor();
      assert.equal(
        await page.evaluate(() => window.fixture.questions.length),
        1,
      );
    },
  );
  await scenario(
    "navigation-plan-support-return",
    "screen=recovery",
    async (page) => {
      await button(page, "Build my support plan").click();
      await page
        .getByRole("textbox", { name: "Item 1", exact: true })
        .fill("Keep my chosen support task");
      await button(page, "Save selected tasks").click();
      await page.getByText("Your plan is saved.", { exact: false }).waitFor();
      await button(page, "Review task sharing").click();
      await page
        .getByRole("heading", { name: "Together", exact: true })
        .waitFor();
      await page.getByRole("tab", { name: "Access", exact: true }).click();
      await page
        .getByRole("checkbox", { name: "Tasks", exact: true })
        .last()
        .click();
      await button(page, "Save category access").click();
      await page.waitForFunction(() =>
        window.appFixture.grants.some((g) => g.permission === "tasks.read"),
      );
      await page
        .getByRole("checkbox", { name: "Custom request", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Short request", exact: true })
        .fill("Help with dinner");
      await button(page, "Send request").click();
      await page
        .getByText(
          "Support request sent without sharing other private records.",
          { exact: true },
        )
        .waitFor();
      await button(page, "Open plans").click();
      await page
        .getByText("Keep my chosen support task", { exact: true })
        .waitFor();
      await page
        .getByText("Help with dinner · open", { exact: true })
        .waitFor();
      await button(page, "Cancel request").click();
      await page
        .getByText("Help with dinner · cancelled", { exact: true })
        .waitFor();
      await page.getByRole("tab", { name: "Together", exact: true }).click();
      await page.getByRole("tab", { name: "Access", exact: true }).click();
      assert.equal(
        await page.evaluate(() =>
          window.appFixture.grants.some((g) => g.permission === "tasks.read"),
        ),
        true,
      );
      await button(page, "Open plans").click();
      assert.equal(
        await page.evaluate(() => window.fixture.projects.length),
        1,
      );
      await page.reload();
      await page
        .getByText("Keep my chosen support task", { exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(() => window.fixture.supportRequests.length),
        1,
      );
    },
  );
  await scenario(
    "navigation-reflection-memory-edit",
    "screen=recovery",
    async (page) => {
      await button(page, "Write a private reflection").click();
      await page
        .getByRole("textbox", { name: "Title (optional)", exact: true })
        .fill("A quiet moment");
      await page
        .getByRole("textbox", { name: "Entry", exact: true })
        .fill("My first thought.");
      await button(page, "What help would make tomorrow easier?").click();
      await button(page, "Save now").click();
      await page.getByText("Saved", { exact: true }).waitFor();
      await page.getByRole("tab", { name: "Memories", exact: true }).click();
      await page.getByText("A quiet moment", { exact: true }).waitFor();
      await button(page, "Open A quiet moment").click();
      assert.match(
        await page
          .getByRole("textbox", { name: "Entry", exact: true })
          .inputValue(),
        /^My first thought\./,
      );
      await page
        .getByRole("textbox", { name: "Entry", exact: true })
        .fill("Updated private reflection.");
      await button(page, "Save now").click();
      await page.getByText("Saved", { exact: true }).waitFor();
      await page.getByRole("tab", { name: "Memories", exact: true }).click();
      await page
        .getByText("Updated private reflection.", { exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(() => window.appFixture.entries.length),
        1,
      );
      assert.equal(
        await page.evaluate(() => window.appFixture.entries[0].privacy),
        "private",
      );
      await button(page, "Add a memory").click();
      assert.equal(
        await page
          .getByRole("textbox", { name: "Entry", exact: true })
          .inputValue(),
        "",
      );
    },
  );
  await scenario(
    "navigation-settings-and-appointment",
    "screen=recovery&disabledRecovery=1&noAppointment=1",
    async (page) => {
      await button(page, "Pregnancy settings").click();
      await page
        .getByRole("checkbox", { name: "Birth recorded", exact: true })
        .click();
      await page
        .getByRole("switch", { name: "Maternal recovery mode", exact: true })
        .last()
        .check();
      await button(page, "Save pregnancy settings").click();
      await button(page, "Open appointments").click();
      await page
        .getByRole("textbox", { name: "Appointment title", exact: true })
        .fill("New preview visit");
      await button(page, "Add appointment record").click();
      await page
        .getByText("New preview visit", { exact: true })
        .first()
        .waitFor();
      await button(page, "Add one question").click();
      await page
        .getByRole("checkbox", { name: "New preview visit", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Question", exact: true })
        .fill("My new appointment question");
      await button(page, "Save question").click();
      await page
        .getByText("My new appointment question", { exact: false })
        .first()
        .waitFor();
    },
  );
  await scenario(
    "navigation-keyboard-and-fallback",
    "screen=unknown",
    async (page) => {
      await button(page, "Open Today").click();
      await page
        .getByText("Preview shortcuts and limits", { exact: true })
        .click();
      const journey = page.getByRole("link", { name: "Journey", exact: true });
      await journey.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("heading", { name: "Journey", exact: true })
        .waitFor();
      assert.equal(await journey.getAttribute("aria-current"), "page");
      await button(page, "← Back").click();
      await page.waitForURL(
        (address) => address.searchParams.get("screen") === "today",
      );
      await page.getByRole("tab", { name: "Today", exact: true }).waitFor();
    },
  );
  await scenario(
    "actual-add-checkin-and-meal",
    "screen=today",
    async (page) => {
      await button(page, "Add").click();
      await button(page, "Check-in").click();
      await page
        .getByRole("checkbox", { name: "Feeling good", exact: true })
        .click();
      await button(page, "Emotions").click();
      await page.getByRole("checkbox", { name: "Calm", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Private note", exact: true })
        .fill("A sample check-in note");
      await button(page, "Complete check-in").click();
      await page.waitForURL(
        (address) => address.searchParams.get("screen") === "today",
      );
      assert.equal(
        await page.evaluate(() => window.appFixture.checkin.values.note),
        "A sample check-in note",
      );
      await button(page, "Add").click();
      await button(page, "Check-in").click();
      await page
        .getByRole("textbox", { name: "Private note", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("textbox", { name: "Private note", exact: true })
          .inputValue(),
        "A sample check-in note",
      );
      await button(page, "Continue later").click();
      await button(page, "Add").click();
      await button(page, "Meal").click();
      await page
        .getByRole("textbox", { name: "Ingredients", exact: true })
        .fill("Rice, beans");
      await page
        .getByRole("textbox", { name: "Notes", exact: true })
        .fill("A simple lunch");
      await page.getByText("Saved", { exact: true }).waitFor();
      await button(page, "Done").click();
      await page.getByRole("tab", { name: "Memories", exact: true }).click();
      await button(page, "Open private meal memory").click();
      await page.getByRole("textbox", { name: "Notes", exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole("textbox", { name: "Notes", exact: true })
          .inputValue(),
        "A simple lunch",
      );
      assert.equal(
        await page.evaluate(() => window.appFixture.meals.length),
        1,
      );
    },
  );
  await scenario(
    "actual-memory-tags-capsule",
    "screen=memories",
    async (page) => {
      await button(page, "Manage tags").click();
      await page
        .getByRole("textbox", { name: "New tag", exact: true })
        .fill("Small moments");
      await button(page, "Add tag").click();
      await page.waitForFunction(() => window.appFixture.tags.length === 1);
      await page
        .getByRole("textbox", { name: "New tag", exact: true })
        .waitFor({ state: "hidden" });
      await button(page, "Add").click();
      await button(page, "Memory").click();
      await page
        .getByRole("textbox", { name: "Title (optional)", exact: true })
        .fill("One small moment");
      await page
        .getByRole("textbox", { name: "Entry", exact: true })
        .fill("A memory for this week");
      for (const name of [
        "Favorite",
        "Include in gentle memory moments",
        "Small moments",
      ])
        await page.getByRole("checkbox", { name, exact: true }).click();
      await button(page, "Save now").click();
      await page.getByText("Saved", { exact: true }).waitFor();
      await page.getByRole("tab", { name: "Together", exact: true }).click();
      await page
        .getByRole("heading", { name: "Together", exact: true })
        .waitFor();
      assert.equal(
        await page.getByText("One small moment", { exact: true }).count(),
        0,
        "private memory not shown in Together",
      );
      await page.getByRole("tab", { name: "Memories", exact: true }).click();
      await button(page, "Review this week's capsule").click();
      await page
        .getByRole("checkbox", { name: "Include", exact: true })
        .click();
      await button(page, "Save 1 moment").click();
      await button(page, "Open One small moment").waitFor();
      assert.equal(
        await page.evaluate(() => window.appFixture.capsules.length),
        1,
      );
      assert.equal(
        await page.evaluate(() => window.appFixture.entries[0].tags[0].name),
        "Small moments",
      );
    },
  );
  await scenario(
    "actual-privacy-notifications-device-boundary",
    "screen=privacy",
    async (page) => {
      await button(page, "Create and share export").click();
      await page
        .getByText("File sharing is not available on this device.", {
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("status")
        .filter({ hasText: "Account export requires" })
        .waitFor();
      await button(page, "Dismiss notice").click();
      await button(page, "Notification privacy").click();
      await page
        .getByRole("switch", {
          name: "Appointments notifications",
          exact: true,
        })
        .last()
        .check();
      await button(page, "Save choices").click();
      await page
        .getByText("Notification choices saved.", { exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(() => window.appFixture.preferences.appointment),
        true,
      );
      await button(page, "← Back").click();
      await button(page, "Review partner access").click();
      await page
        .getByRole("heading", { name: "Together", exact: true })
        .waitFor();
    },
  );
  await scenario(
    "actual-provider-summary",
    "screen=questions",
    async (page) => {
      await button(page, "Fixture follow-up").click();
      await page
        .getByRole("textbox", { name: "Question", exact: true })
        .fill("My question for the summary");
      await button(page, "Save question").click();
      await button(page, "Prepare provider summary").click();
      await page
        .getByRole("textbox", { name: "End date", exact: true })
        .fill("2099-12-31");
      await button(page, "Generate selected summary").click();
      const summary = page.getByRole("textbox", {
        name: "Editable user-reported summary",
        exact: true,
      });
      assert.match(await summary.inputValue(), /My question for the summary/);
      await summary.fill("My reviewed sample summary");
      await button(page, "Share reviewed PDF").click();
      await page
        .getByRole("status")
        .filter({ hasText: "System sharing requires" })
        .waitFor();
    },
  );
  for (const [screen, text] of [
    [
      "health",
      "Phone health connections are not enabled in this build. Flutterings has not asked for permission and has not read health data.",
    ],
    ["help", "No approved localized guidance available"],
    ["meals", "Meals"],
  ]) {
    await scenario(
      `actual-${screen}-screen`,
      `screen=${screen}`,
      async (page) => {
        await page.getByText(text, { exact: true }).first().waitFor();
        await page.getByRole("tab", { name: "Today", exact: true }).click();
        await page.waitForURL(
          (address) => address.searchParams.get("screen") === "today",
        );
      },
    );
  }
  await scenario(
    "actual-lifecycle-stage-and-desktop",
    "screen=today",
    async (page) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .getByRole("combobox", { name: "Demo stage" })
        .selectOption("birth");
      await page
        .getByRole("heading", { name: "Support after birth", exact: true })
        .waitFor();
      await page
        .getByText("Preview shortcuts and limits", { exact: true })
        .click();
      await page.getByRole("link", { name: "Journey", exact: true }).click();
      await page
        .getByText("Journey progression is hidden", { exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByText("Synthetic reviewed reading", { exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("combobox", { name: "Demo stage" })
        .selectOption("active");
      await page.getByRole("link", { name: "Journey", exact: true }).click();
      await button(page, "Save a question for my visit").waitFor();
    },
  );
  const storageKey = "flutterings.preview.v1";
  await scenario(
    "persistence-saved-records-and-reopen",
    "screen=planning",
    async (page) => {
      await button(page, "Hospital bag").click();
      await page
        .getByRole("textbox", { name: "Item 1", exact: true })
        .fill("Keep this packing task");
      await button(page, "Save selected tasks").click();
      await page.getByText("Your plan is saved.", { exact: false }).waitFor();
      await page.getByRole("tab", { name: "Care", exact: true }).click();
      await button(page, "Add one question").click();
      await button(page, "Fixture follow-up").click();
      await page
        .getByRole("textbox", { name: "Question", exact: true })
        .fill("Keep this appointment question");
      await button(page, "Save question").click();
      await button(page, "Add one question").waitFor();
      await page
        .getByRole("combobox", { name: "Demo stage" })
        .selectOption("birth");
      await page
        .getByRole("heading", { name: "Support after birth", exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByRole("heading", { name: "Support after birth", exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(() => window.fixture.tasks[0].title),
        "Keep this packing task",
      );
      assert.equal(
        await page.evaluate(() => window.fixture.questions[0].text),
        "Keep this appointment question",
      );
      assert.equal(
        await page.getByRole("combobox", { name: "Demo stage" }).inputValue(),
        "birth",
      );
      const reopened = await page.context().newPage();
      await reopened.goto(`${url}?screen=planning`);
      await reopened
        .getByText("Keep this packing task", { exact: true })
        .waitFor();
      assert.equal(
        await reopened.evaluate(
          () => window.appFixture.pregnancy.lifecycleStatus,
        ),
        "birth",
      );
      await reopened.close();
    },
  );
  await scenario(
    "persistence-journal-draft-immediate-refresh",
    "screen=reflection&entryId=new&offline=1",
    async (page) => {
      await page
        .getByRole("textbox", { name: "Title (optional)", exact: true })
        .fill("Keep my draft");
      await page
        .getByRole("textbox", { name: "Entry", exact: true })
        .fill("Words written before refresh");
      await page.reload();
      const entry = page.getByRole("textbox", { name: "Entry", exact: true });
      await entry.waitFor();
      assert.equal(await entry.inputValue(), "Words written before refresh");
      assert.equal(
        await page
          .getByRole("textbox", { name: "Title (optional)", exact: true })
          .inputValue(),
        "Keep my draft",
      );
      await page.getByRole("tab", { name: "Memories", exact: true }).click();
      await button(page, "Add a memory").click();
      await entry.waitFor();
      assert.equal(
        await entry.inputValue(),
        "",
        "a new entry does not reuse the previous draft",
      );
      await page.getByRole("tab", { name: "Memories", exact: true }).click();
      await page.getByText("Keep my draft", { exact: true }).waitFor();
    },
  );
  await scenario(
    "persistence-meal-checkin-settings",
    "screen=today",
    async (page) => {
      await button(page, "Add").click();
      await button(page, "Meal").click();
      await page
        .getByRole("textbox", { name: "Notes", exact: true })
        .fill("Meal draft across refresh");
      await page.reload();
      const notes = page.getByRole("textbox", { name: "Notes", exact: true });
      await notes.waitFor();
      assert.equal(await notes.inputValue(), "Meal draft across refresh");
      await page.getByRole("tab", { name: "Today", exact: true }).click();
      await button(page, "Add").click();
      await button(page, "Check-in").click();
      await page
        .getByRole("textbox", { name: "Private note", exact: true })
        .fill("Check-in across refresh");
      await page.reload();
      const note = page.getByRole("textbox", {
        name: "Private note",
        exact: true,
      });
      await note.waitFor();
      assert.equal(await note.inputValue(), "Check-in across refresh");
      await page.getByRole("tab", { name: "Together", exact: true }).click();
      await button(page, "Notification choices").click();
      await page
        .getByRole("switch", {
          name: "Appointments notifications",
          exact: true,
        })
        .last()
        .check();
      await button(page, "Save choices").click();
      await page
        .getByText("Notification choices saved.", { exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByRole("switch", {
          name: "Appointments notifications",
          exact: true,
        })
        .last()
        .waitFor();
      assert.equal(
        await page
          .getByRole("switch", {
            name: "Appointments notifications",
            exact: true,
          })
          .last()
          .isChecked(),
        true,
      );
    },
  );
  await scenario(
    "persistence-reset-confirmation",
    "screen=planning",
    async (page) => {
      await button(page, "Hospital bag").click();
      await button(page, "Save selected tasks").click();
      await page.getByText("Your plan is saved.", { exact: false }).waitFor();
      await page.evaluate(() =>
        localStorage.setItem("unrelated-preview-test", "keep"),
      );
      await page
        .getByText("Preview shortcuts and limits", { exact: true })
        .click();
      page.once("dialog", (dialog) => dialog.dismiss());
      await button(page, "Reset saved preview").click();
      assert.equal(
        await page.evaluate(() => window.fixture.projects.length),
        1,
      );
      page.once("dialog", (dialog) => dialog.accept());
      await button(page, "Reset saved preview").click();
      await page.waitForURL(
        (address) => address.searchParams.get("screen") === "today",
      );
      await button(page, "Add").waitFor();
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), storageKey),
        null,
      );
      assert.equal(
        await page.evaluate(() => window.fixture.projects.length),
        0,
      );
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("unrelated-preview-test"),
        ),
        "keep",
      );
      await page.reload();
      await button(page, "Add").waitFor();
      assert.equal(
        await page.evaluate(() => window.fixture.projects.length),
        0,
      );
    },
  );
  await scenario(
    "persistence-storage-failure-retry",
    "screen=planning",
    async (page) => {
      await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        window.restorePreviewStorage = () => {
          Storage.prototype.setItem = original;
        };
        Storage.prototype.setItem = function (key, value) {
          if (key === "flutterings.preview.v1")
            throw new DOMException("Test quota failure", "QuotaExceededError");
          return original.call(this, key, value);
        };
      });
      await button(page, "Hospital bag").click();
      await button(page, "Save selected tasks").click();
      await page
        .getByRole("status", { name: "Preview save status" })
        .filter({ hasText: "Changes are not saved" })
        .waitFor();
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), storageKey),
        null,
      );
      await page.evaluate(() => window.restorePreviewStorage());
      await button(page, "Retry local save").click();
      await page
        .getByRole("status", { name: "Preview save status" })
        .filter({ hasText: "Saved in this browser" })
        .waitFor();
      await page.reload();
      await button(page, "Mark complete").first().waitFor();
      assert.equal(
        await page.evaluate(() => window.fixture.projects.length),
        1,
      );
    },
  );
  await scenario(
    "persistence-corrupt-data-preserved",
    "screen=today",
    async (page) => {
      await page.evaluate(
        (key) => localStorage.setItem(key, "{invalid-json"),
        storageKey,
      );
      await page.reload();
      await page
        .getByRole("status", { name: "Preview save status" })
        .filter({ hasText: "could not be read" })
        .waitFor();
      await page
        .getByRole("combobox", { name: "Demo stage" })
        .selectOption("birth");
      await page
        .getByRole("heading", { name: "Support after birth", exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), storageKey),
        "{invalid-json",
      );
    },
  );
  await scenario(
    "persistence-stale-tab-protection",
    "screen=planning",
    async (page) => {
      const other = await page.context().newPage();
      await other.goto(`${url}?screen=planning`);
      await button(other, "Hospital bag").waitFor();
      await button(page, "Hospital bag").click();
      await button(page, "Save selected tasks").click();
      await page.getByText("Your plan is saved.", { exact: false }).waitFor();
      await other
        .getByRole("status", { name: "Preview save status" })
        .filter({ hasText: "Another tab changed" })
        .waitFor();
      const saved = await page.evaluate(
        (key) => localStorage.getItem(key),
        storageKey,
      );
      await button(other, "Birth preferences").click();
      await button(other, "Save selected tasks").click();
      await other.getByText("Your plan is saved.", { exact: false }).waitFor();
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), storageKey),
        saved,
        "stale tab cannot overwrite stored records",
      );
      other.once("dialog", (dialog) => dialog.accept());
      await button(other, "Load saved preview").click();
      await button(other, "Mark complete").first().waitFor();
      assert.equal(
        await other.evaluate(() => window.fixture.projects[0].title),
        "Hospital bag",
      );
      await other.close();
    },
  );
  await scenario(
    "persistence-not-today-expires",
    "screen=today",
    async (page) => {
      await button(page, "Prepare for visit").waitFor();
      await button(page, "Not today").click();
      await button(page, "Read this week").waitFor();
      await page.reload();
      await button(page, "Read this week").waitFor();
      // Move only the fixture dismissal date back; the real Today screen should show the visit again.
      await page.evaluate((key) => {
        const snapshot = JSON.parse(localStorage.getItem(key));
        snapshot.slices.app.hiddenModulesDate = "2000-01-01";
        localStorage.setItem(key, JSON.stringify(snapshot));
      }, storageKey);
      await page.reload();
      await button(page, "Prepare for visit").waitFor();
    },
  );
} catch (error) {
  failure = error;
} finally {
  await harness.close(failure);
}
