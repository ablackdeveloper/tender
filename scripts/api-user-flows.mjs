import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Each case gets a separate identity and pregnancy in a disposable real database.
// All behavior under test runs through production repositories and HTTP/PostgREST.
export async function runApiUserFlows({
  scenario,
  sql,
  client,
  sign,
  repositories,
  workspace,
  ok,
}) {
  async function fresh() {
    const owner = randomUUID(),
      stranger = randomUUID(),
      pregnancy = randomUUID();
    await sql(`insert into auth.users(id,email,role,aud,email_confirmed_at) values
      ('${owner}','${owner}@example.invalid','authenticated','authenticated',now()),
      ('${stranger}','${stranger}@example.invalid','authenticated','authenticated',now());`);
    const http = client(sign(owner));
    ok(
      await http.rpc("complete_onboarding", {
        p_pregnancy_id: pregnancy,
        p_lmp_date: null,
        p_estimated_due_date: null,
        p_due_date_source: null,
        p_clinician_confirmed_at: null,
        p_timezone: "UTC",
        p_pregnancy_type: "unspecified",
        p_display_name: "",
        p_theme_preference: "system",
        p_measurement_system: "metric",
        p_editorial_updates_enabled: false,
        p_appointment_reminders_enabled: false,
        p_planning_reminders_enabled: false,
      }),
    );
    const reconnect = () => repositories(workspace, client(sign(owner)));
    return {
      owner,
      pregnancy,
      http,
      repo: reconnect(),
      reconnect,
      other: repositories(workspace, client(sign(stranger))),
    };
  }
  for (const action of [
    "retry",
    "rename",
    "complete",
    "remove-restore",
    "add-task",
    "foreign-write",
  ]) {
    await scenario(`planning-api-${action}`, async () => {
      const { owner, pregnancy, repo, other, reconnect } = await fresh();
      const input = {
        projectId: randomUUID(),
        pregnancyId: pregnancy,
        title: "Local plan",
        tasks: ["One", "Two"],
      };
      assert.equal(
        (await repo.planningRepository.list(pregnancy)).projects.length,
        0,
      );
      await repo.planningRepository.createList(input);
      const task = (await repo.planningRepository.list(pregnancy)).tasks[0];
      if (action === "retry") await repo.planningRepository.createList(input);
      if (action === "rename")
        await repo.planningRepository.renameTask(
          owner,
          task.id,
          "  My words  ",
        );
      if (action === "complete")
        await repo.planningRepository.setTaskStatus(owner, task.id, true);
      if (action === "remove-restore") {
        await repo.planningRepository.setTaskRemoved(owner, task.id, true);
        assert.equal(
          (await reconnect().planningRepository.list(pregnancy)).tasks[0]
            .status,
          "cancelled",
        );
        await repo.planningRepository.setTaskRemoved(owner, task.id, false);
      }
      if (action === "add-task")
        await repo.planningRepository.addTask(owner, input.projectId, "Three");
      if (action === "foreign-write") {
        await other.planningRepository.renameTask(owner, task.id, "Forbidden");
        await assert.rejects(() =>
          other.planningRepository.addTask(owner, input.projectId, "Forbidden"),
        );
      }
      const saved = await reconnect().planningRepository.list(pregnancy);
      assert.equal(saved.projects.length, 1);
      assert.equal(saved.tasks.length, action === "add-task" ? 3 : 2);
      assert.equal(
        saved.tasks.find((item) => item.id === task.id).title,
        action === "rename" ? "My words" : "One",
      );
      assert.equal(
        saved.tasks.find((item) => item.id === task.id).status,
        action === "complete" ? "completed" : "open",
      );
      assert.deepEqual(await other.planningRepository.list(pregnancy), {
        projects: [],
        tasks: [],
        supportRequests: [],
      });
    });
  }
  await scenario("support-request-create-cancel-owner-isolation", async () => {
    const { owner, pregnancy, repo, other, reconnect } = await fresh();
    await repo.planningRepository.addSupportRequest(
      owner,
      pregnancy,
      "Local support",
      null,
    );
    let rows = (await reconnect().planningRepository.list(pregnancy))
      .supportRequests;
    assert.equal(rows.length, 1);
    await other.planningRepository.cancelSupportRequest(owner, rows[0].id);
    assert.equal(
      (await reconnect().planningRepository.list(pregnancy)).supportRequests[0]
        .status,
      "open",
    );
    await repo.planningRepository.cancelSupportRequest(owner, rows[0].id);
    assert.equal(
      (await reconnect().planningRepository.list(pregnancy)).supportRequests[0]
        .status,
      "cancelled",
    );
  });
  for (const kind of ["provider", "contact", "medication"]) {
    await scenario(`care-api-${kind}-save-delete-isolation`, async () => {
      const { owner, pregnancy, repo, other, reconnect } = await fresh();
      const care = repo.careRepository;
      const table = {
        provider: "providers",
        contact: "emergency_contacts",
        medication: "medications",
      }[kind];
      const slice = {
        provider: "providers",
        contact: "contacts",
        medication: "medications",
      }[kind];
      if (kind === "provider")
        await care.addProvider(owner, pregnancy, {
          name: "Local provider",
          phone: "+12025550123",
          specialty: "",
          organization: "",
          address: "",
          email: "",
          isPrimary: true,
        });
      if (kind === "contact")
        await care.addContact(owner, pregnancy, {
          name: "Local contact",
          phone: "+12025550123",
          relationship: "",
          notes: "",
          priority: 1,
        });
      if (kind === "medication")
        await care.addMedication(owner, pregnancy, {
          name: "Local record",
          strength: "",
          form: "",
          instructions: "Recorded only",
          status: "active",
        });
      const rows = (
        await reconnect().careRepository.getContext(owner, pregnancy)
      )[slice];
      assert.equal(rows.length, 1);
      assert.equal(
        (await other.careRepository.getContext(owner, pregnancy))[slice].length,
        0,
      );
      await other.careRepository.remove(owner, table, rows[0].id);
      assert.equal(
        (await reconnect().careRepository.getContext(owner, pregnancy))[slice]
          .length,
        1,
      );
      await care.remove(owner, table, rows[0].id);
      assert.equal(
        (await reconnect().careRepository.getContext(owner, pregnancy))[slice]
          .length,
        0,
      );
    });
  }
  await scenario("care-question-answer-reopen-note-cascade", async () => {
    const { owner, pregnancy, repo, reconnect } = await fresh();
    const care = repo.careRepository;
    await care.addAppointment(owner, pregnancy, {
      title: "Local visit",
      startsAt: new Date().toISOString(),
      endsAt: null,
      timezone: "UTC",
      location: "",
      providerId: null,
      reason: "",
    });
    const visit = (await care.getContext(owner, pregnancy)).appointments[0];
    await care.addQuestion(owner, visit.id, "Local question", 0, 1);
    await care.addAppointmentNote(owner, visit.id, "Private note");
    const question = (await care.getContext(owner, pregnancy)).appointments[0]
      .questions[0];
    await care.updateQuestion(owner, question.id, {
      status: "answered",
      selectedForSummary: true,
      priority: 3,
    });
    let saved = (await reconnect().careRepository.getContext(owner, pregnancy))
      .appointments[0];
    assert.equal(saved.questions[0].status, "answered");
    assert.ok(saved.questions[0].answeredAt);
    assert.equal(saved.questions[0].selectedForSummary, true);
    assert.equal(saved.questions[0].priority, 3);
    assert.equal(saved.notes[0].body, "Private note");
    await care.updateQuestion(owner, question.id, { status: "open" });
    saved = (await reconnect().careRepository.getContext(owner, pregnancy))
      .appointments[0];
    assert.equal(saved.questions[0].answeredAt, null);
    await care.remove(owner, "appointments", visit.id);
    assert.equal(
      (await reconnect().careRepository.getContext(owner, pregnancy))
        .appointments.length,
      0,
    );
  });
  for (const status of ["paused", "loss", "ended", "birth", "archived"]) {
    await scenario(`lifecycle-api-${status}-restore`, async () => {
      const { pregnancy, owner, repo, other, reconnect } = await fresh();
      await repo.pregnancyLifecycleRepository.updateDueDate(
        owner,
        pregnancy,
        "2027-04-01",
      );
      assert.equal(
        (await reconnect().todayJourneyRepository.getToday(owner)).experience
          .showCountdown,
        true,
      );
      const transition = {
        pregnancyId: pregnancy,
        status,
        compassionateMode: false,
        postpartumMode: status === "birth",
      };
      await assert.rejects(() =>
        other.pregnancyLifecycleRepository.transition(transition),
      );
      await repo.pregnancyLifecycleRepository.transition(transition);
      let state = await reconnect().todayJourneyRepository.getToday(owner);
      assert.equal(state.pregnancy.lifecycleStatus, status);
      assert.equal(state.experience.showWeeklyContent, false);
      assert.equal(state.experience.showCountdown, false);
      assert.equal(state.experience.showGestationalProgress, false);
      if (status === "loss")
        assert.equal(state.pregnancy.compassionateMode, true);
      if (status === "birth")
        assert.equal(state.pregnancy.postpartumMode, true);
      await repo.pregnancyLifecycleRepository.transition({
        ...transition,
        status: "active",
        compassionateMode: false,
        postpartumMode: false,
      });
      state = await reconnect().todayJourneyRepository.getToday(owner);
      assert.equal(state.pregnancy.lifecycleStatus, "active");
      assert.equal(state.experience.showCountdown, true);
    });
  }
  await scenario("due-date-add-clear-without-losing-records", async () => {
    const { owner, pregnancy, repo, other, reconnect } = await fresh();
    await repo.planningRepository.addProject(
      owner,
      pregnancy,
      "Keep this plan",
    );
    await repo.pregnancyLifecycleRepository.updateDueDate(
      owner,
      pregnancy,
      "2027-04-01",
    );
    assert.equal(
      (await reconnect().todayJourneyRepository.getToday(owner)).pregnancy
        .estimatedDueDate,
      "2027-04-01",
    );
    await assert.rejects(() =>
      other.pregnancyLifecycleRepository.updateDueDate(owner, pregnancy, null),
    );
    await repo.pregnancyLifecycleRepository.updateDueDate(
      owner,
      pregnancy,
      null,
    );
    assert.equal(
      (await reconnect().todayJourneyRepository.getToday(owner)).pregnancy
        .estimatedDueDate,
      null,
    );
    assert.equal(
      (await reconnect().planningRepository.list(pregnancy)).projects.length,
      1,
    );
  });
  for (const focus of ["balanced", "memories", "care", "support"]) {
    await scenario(`preferences-api-${focus}-reconnect`, async () => {
      const { owner, repo, other, reconnect } = await fresh();
      const value = {
        focus,
        showWeeklyContent: false,
        showDueDate: false,
        showProgressCounts: false,
        showSizeComparisons: false,
      };
      await repo.homePreferencesRepository.save(owner, value);
      await assert.rejects(() =>
        other.homePreferencesRepository.save(owner, {
          ...value,
          showWeeklyContent: true,
        }),
      );
      assert.deepEqual(
        await reconnect().homePreferencesRepository.get(owner),
        value,
      );
    });
  }
  for (const timezone of ["UTC", "America/New_York", "Asia/Tokyo"]) {
    await scenario(
      `notifications-api-${timezone.replaceAll("/", "-")}`,
      async () => {
        const { owner, repo, other, reconnect } = await fresh();
        const value = {
          appointment: true,
          medicationAsRecorded: false,
          weeklyUpdate: false,
          photo: true,
          partnerRequest: true,
          revealingContent: false,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          timezone,
        };
        await repo.notificationPreferencesRepository.save(owner, value);
        await assert.rejects(() =>
          other.notificationPreferencesRepository.save(owner, {
            ...value,
            revealingContent: true,
          }),
        );
        const saved =
          await reconnect().notificationPreferencesRepository.get(owner);
        assert.equal(saved.timezone, timezone);
        assert.equal(saved.revealingContent, false);
        assert.match(saved.quietHoursStart, /^22:00/);
        assert.match(saved.quietHoursEnd, /^08:00/);
        assert.equal(saved.appointment, true);
      },
    );
  }
}
