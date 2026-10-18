// Browser-local service boundary for actual app screens. No production clients are imported.
import {
  registerSlice,
  matchesShape,
  persistMethods,
  savePreview,
} from "./persistence";
import { state, planningRepository, write, flags } from "./fixtures";
import { pregnancyExperience, derivePregnancyDating } from "@tender/domain";
import { togetherInvitationSchema } from "@/schemas/together";
import { onboardingDraftSchema } from "@/schemas/onboarding";
import {
  applyHomePreferences,
  defaultHomePreferences,
  homePreferencesSchema,
} from "@/features/today-journey/home-preferences";
import { journalSaveInputSchema } from "@/schemas/journal";
import {
  providerInputSchema,
  emergencyContactInputSchema,
  appointmentInputSchema,
  medicationInputSchema,
  medicationChangeInputSchema,
} from "@/schemas/care";
export { planningRepository };
export const ownerId = "b0000000-0000-4000-8000-000000000001";
export const pregnancyId = "b1000000-0000-4000-8000-000000000001";
const partnerId = "b0000000-0000-4000-8000-000000000002";
const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
const uuid = () => crypto.randomUUID();
const afterBirth =
  flags.get("screen") === "recovery" && !flags.has("disabledRecovery");
export const data: any = {
  pregnancy: {
    id: pregnancyId,
    clinicianConfirmedAt: null,
    dueDateSource: "manual",
    endedAt: null,
    estimatedDueDate: new Date(Date.now() + 140 * 86400000)
      .toISOString()
      .slice(0, 10),
    lmpDate: null,
    compassionateMode: false,
    lifecycleStatus: afterBirth ? "birth" : "active",
    postpartumMode: afterBirth,
    statusBeforeArchive: null,
    timezone: "America/New_York",
  },
  appointments: flags.has("noAppointment")
    ? []
    : [
        {
          id: "synthetic-visit",
          title: "Fixture follow-up",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          endsAt: null,
          location: "Sample care office",
          providerId: null,
          notes: [],
          reason: "",
          status: "scheduled",
          timezone: "America/New_York",
        },
      ],
  providers: [],
  contacts: [],
  documents: [],
  medications: [],
  medicationChanges: [],
  entries: [],
  tags: [],
  meals: [],
  capsules: [],
  hiddenModules: [],
  members: [
    { id: uuid(), role: "owner", status: "active", userId: ownerId },
    { id: uuid(), role: "partner", status: "active", userId: partnerId },
  ],
  grants: [{ granteeUserId: partnerId, permission: "support_requests.read" }],
  overrides: [],
  invitations: [],
  history: [],
  notifications: [],
  preferences: {
    appointment: false,
    medicationAsRecorded: false,
    weeklyUpdate: false,
    photo: false,
    partnerRequest: false,
    revealingContent: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    timezone: "America/New_York",
  },
  defaultAction: null,
};
registerSlice("app", data, (value) =>
  matchesShape(value, {
    ...data,
    pregnancy: { ...data.pregnancy, estimatedDueDate: null },
  }),
);
if (flags.has("undated")) {
  data.pregnancy.estimatedDueDate = null;
  data.pregnancy.dueDateSource = "unknown";
}
if (flags.has("noPregnancy")) data.hasPregnancy = false;
(window as any).appFixture = data;
const drafts = {
  journal: [] as any[],
  meal: [] as any[],
  checkin: [] as any[],
};
registerSlice("drafts", drafts, (value) => matchesShape(value, drafts));
function storage(kind: keyof typeof drafts, key: (value: any) => string) {
  return {
    async list() {
      return clone(drafts[kind]);
    },
    async load(...args: string[]) {
      const params = new URLSearchParams(location.search);
      const id =
        kind === "journal" && params.get("entryId") === "new"
          ? (history.state?.previewDraftId ?? args.at(-1))
          : args.at(-1);
      return clone(drafts[kind].find((value) => key(value) === id) ?? null);
    },
    async save(_owner: string, value: any) {
      drafts[kind] = [
        ...drafts[kind].filter((item) => key(item) !== key(value)),
        clone(value),
      ];
      if (
        kind === "journal" &&
        new URLSearchParams(location.search).get("entryId") === "new"
      )
        history.replaceState(
          { ...history.state, previewDraftId: key(value) },
          "",
          location.href,
        );
      savePreview();
    },
    async remove(_owner: string, id: string) {
      drafts[kind] = drafts[kind].filter((value) => key(value) !== id);
      if (kind === "journal" && history.state?.previewDraftId === id)
        history.replaceState(
          { ...history.state, previewDraftId: null },
          "",
          location.href,
        );
      savePreview();
    },
    async clear() {
      drafts[kind] = [];
      savePreview();
    },
  };
}
export const journalDraftStorage = storage("journal", (v) => v.entryId);
export const mealDraftStorage = storage("meal", (v) => v.mealId);
export const checkInDraftStorage = storage("checkin", (v) => v.checkinDate);
// A separate slice keeps snapshots from older previews readable.
const questionDrafts = registerSlice(
  "questionDrafts",
  { items: [] as any[] },
  (value) => matchesShape(value, { items: [] }),
);
export const questionDraftStorage = {
  async load(_owner: string, id?: string) {
    return clone(
      (id
        ? questionDrafts.items.find((v) => v.pregnancyId === id)
        : questionDrafts.items.at(-1)) ?? null,
    );
  },
  async save(_owner: string, value: any) {
    questionDrafts.items = questionDrafts.items
      .filter((v) => v.pregnancyId !== value.pregnancyId)
      .concat(clone(value));
    if (!savePreview()) throw new Error("preview_storage_unavailable");
  },
  async clear(_owner: string, id: string) {
    questionDrafts.items = questionDrafts.items.filter(
      (v) => v.pregnancyId !== id,
    );
    if (!savePreview()) throw new Error("preview_storage_unavailable");
  },
};
export function entryToDraft(entry: any) {
  return {
    baseServerUpdatedAt: entry.updatedAt,
    body: entry.body,
    entryAt: entry.entryAt,
    entryId: entry.id,
    isFavorite: entry.isFavorite,
    media: [],
    pregnancyId,
    privacy: entry.privacy,
    resurfaceAllowed: entry.resurfaceAllowed,
    status: "saved",
    tagIds: entry.tags.map((tag: any) => tag.id),
    title: entry.title,
    updatedAt: entry.updatedAt,
    version: 1,
  };
}
export const journalRepository = {
  async getActivePregnancy() {
    return data.hasPregnancy === false ? null : pregnancyId;
  },
  async listTags() {
    return clone(data.tags);
  },
  async createTag(_owner: string, name: string) {
    await write();
    data.tags.push({ id: uuid(), name: name.trim() });
  },
  async getEntry(_owner: string, id: string) {
    return clone(data.entries.find((e: any) => e.id === id) ?? null);
  },
  async listEntries(_owner: string, _pregnancy: string, filter: any) {
    return clone(
      data.entries.filter(
        (e: any) =>
          (!filter.favoritesOnly || e.isFavorite) &&
          (!filter.privacy || e.privacy === filter.privacy) &&
          (!filter.tagId || e.tags.some((t: any) => t.id === filter.tagId)) &&
          (!filter.start ||
            e.entryAt >= new Date(`${filter.start}T00:00:00`).toISOString()) &&
          (!filter.end ||
            e.entryAt <=
              new Date(`${filter.end}T23:59:59.999`).toISOString()) &&
          `${e.title} ${e.body}`
            .toLowerCase()
            .includes(filter.query.toLowerCase()),
      ),
    );
  },
  async save(input: any) {
    await write();
    const v = journalSaveInputSchema.parse(input);
    const updatedAt = now();
    const entry = {
      ...v,
      id: v.entryId,
      updatedAt,
      media: [],
      tags: data.tags.filter((t: any) => v.tagIds.includes(t.id)),
    };
    data.entries = [
      ...data.entries.filter((e: any) => e.id !== v.entryId),
      entry,
    ];
    return { status: "saved", updatedAt };
  },
  async deleteEntry(_owner: string, id: string) {
    await write();
    data.entries = data.entries.filter((e: any) => e.id !== id);
    await journalDraftStorage.remove(ownerId, id);
  },
  async saveWeeklyCapsule(input: any) {
    await write();
    const id = uuid();
    data.capsules.push({ ...clone(input), id });
    return id;
  },
  async getSignedMediaUrl() {
    throw new Error("Media requires the device app in this preview.");
  },
  async deleteMedia() {
    await write();
  },
};
export const careRepository = {
  async getContext() {
    return clone({
      appointments: data.appointments.map((a: any) => ({
        ...a,
        questions: state.questions
          .filter((q) => q.appointmentId === a.id && q.status !== "removed")
          .map((q) => ({ ...q, question: q.text })),
      })),
      providers: data.providers,
      contacts: data.contacts,
      documents: data.documents,
      medications: data.medications,
      medicationChanges: data.medicationChanges,
    });
  },
  async addQuestion(
    _owner: string,
    appointmentId: string,
    text: string,
    position: number,
    priority = 1,
  ) {
    await write();
    if (!text.trim()) throw new Error("question_required");
    state.questions.push({
      id: uuid(),
      appointmentId,
      text,
      position,
      priority,
      status: "open",
      selectedForSummary: true,
      answeredAt: null,
    });
  },
  async updateQuestion(_owner: string, id: string, patch: any) {
    await write();
    Object.assign(
      state.questions.find((q) => q.id === id),
      patch,
    );
  },
  async addAppointment(_owner: string, _pregnancy: string, input: any) {
    await write();
    data.appointments.push({
      ...appointmentInputSchema.parse(input),
      id: uuid(),
      notes: [],
      status: "scheduled",
    });
  },
  async addProvider(_owner: string, _pregnancy: string, input: any) {
    await write();
    data.providers.push({ ...providerInputSchema.parse(input), id: uuid() });
  },
  async addContact(_owner: string, _pregnancy: string, input: any) {
    await write();
    data.contacts.push({
      ...emergencyContactInputSchema.parse(input),
      id: uuid(),
    });
  },
  async addMedication(_owner: string, _pregnancy: string, input: any) {
    await write();
    data.medications.push({
      ...medicationInputSchema.parse(input),
      id: uuid(),
    });
  },
  async addMedicationChange(_owner: string, input: any) {
    await write();
    data.medicationChanges.push({
      ...medicationChangeInputSchema.parse(input),
      id: uuid(),
    });
  },
  async addAppointmentNote(_owner: string, id: string, body: string) {
    await write();
    data.appointments
      .find((a: any) => a.id === id)
      .notes.push({ id: uuid(), authoredAt: now(), body });
  },
  async remove(_owner: string, table: string, id: string) {
    await write();
    const key =
      (
        {
          emergency_contacts: "contacts",
          medication_change_records: "medicationChanges",
        } as any
      )[table] ?? table;
    data[key] = data[key].filter((r: any) => r.id !== id);
  },
  async getSummaryCandidates(
    _owner: string,
    _pregnancy: string,
    start: string,
    end: string,
  ) {
    const within = (date: string) => date >= start && date <= end;
    const visits = data.appointments.filter((a: any) =>
      within(a.startsAt.slice(0, 10)),
    );
    const checkin =
      data.checkin && within(data.checkin.checkinDate) ? data.checkin : null;
    return clone([
      ...state.questions
        .filter(
          (q) =>
            q.selectedForSummary &&
            q.status !== "removed" &&
            visits.some((a: any) => a.id === q.appointmentId),
        )
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 3)
        .map((q) => ({
          id: `question:${q.id}`,
          category: "question",
          date: visits
            .find((a: any) => a.id === q.appointmentId)
            .startsAt.slice(0, 10),
          label: q.text,
          detail: q.status === "answered" ? "marked answered by the user" : "",
        })),
      ...(checkin?.values.symptoms ?? []).map((s: any) => ({
        id: `symptom:${s.slug}`,
        category: "symptom",
        date: checkin.checkinDate,
        label: s.slug === "tiredness" ? "Tiredness" : s.slug,
        detail: s.severity
          ? `severity recorded as ${{ mild: 1, moderate: 2, severe: 3 }[s.severity as string]} of 3`
          : "",
      })),
      ...Object.entries(checkin?.values.wellness ?? {})
        .filter(([, value]) => value)
        .map(([key, value]) => ({
          id: `observation:${key}`,
          category: "observation",
          date: checkin.checkinDate,
          label: key,
          detail: value,
        })),
      ...data.medicationChanges
        .filter((m: any) => within(m.recordedOn))
        .map((m: any) => ({
          id: `medication:${m.id}`,
          category: "medication",
          date: m.recordedOn,
          label:
            data.medications.find((item: any) => item.id === m.medicationId)
              ?.name ?? "Medication record",
          detail: m.details || m.changeKind.replaceAll("_", " "),
        })),
    ]);
  },
  async getHelpResources() {
    return [];
  },
  async deleteDocument(_owner: string, id: string) {
    data.documents = data.documents.filter((d: any) => d.id !== id);
  },
};
export const togetherRepository = {
  async getContext() {
    return clone({
      ownerId,
      pregnancyId,
      isOwner: true,
      members: data.members,
      grants: data.grants,
      invitations: data.invitations,
      history: data.history,
      notifications: data.notifications,
      overrides: data.overrides,
      items: [
        ...state.tasks
          .filter((t) => t.status !== "cancelled")
          .map((t) => ({
            id: t.id,
            title: t.title,
            subtitle: t.status,
            date: null,
            permission: "tasks.read",
            resourceType: "task",
          })),
        ...state.supportRequests.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.status,
          date: null,
          permission: "support_requests.read",
          resourceType: "support_request",
        })),
        ...data.appointments.map((a: any) => ({
          id: a.id,
          title: a.title,
          subtitle: a.location,
          date: a.startsAt,
          permission: "appointments.read",
          resourceType: "appointment",
        })),
        ...data.entries
          .filter((e: any) => e.privacy === "shared")
          .map((e: any) => ({
            id: e.id,
            title: e.title,
            subtitle: e.body,
            date: e.entryAt,
            permission: "journal.read",
            resourceType: "journal_entry",
          })),
      ],
    });
  },
  async markNotificationRead(id: string) {
    data.notifications.find((n: any) => n.id === id).readAt = now();
  },
  async respondToSupportRequest(id: string, status: string) {
    await write();
    state.supportRequests.find((r) => r.id === id).status = status;
  },
};
const historyEvent = (eventType: string) =>
  data.history.unshift({
    id: uuid(),
    eventType,
    resourceType: "preview_sharing",
    occurredAt: now(),
  });
export const partnerSharingService = {
  async setPermissions(granteeUserId: string, permissions: string[]) {
    await write();
    data.grants = data.grants
      .filter((g: any) => g.granteeUserId !== granteeUserId)
      .concat(permissions.map((permission) => ({ granteeUserId, permission })));
    historyEvent("permissions_changed");
  },
  async setItemOverride(input: any) {
    await write();
    data.overrides = data.overrides
      .filter((o: any) => o.resourceId !== input.resourceId)
      .concat(input);
    historyEvent("item_access_changed");
  },
  async revokePartner(id: string) {
    await write();
    data.members = data.members.map((m: any) =>
      m.userId === id ? { ...m, status: "revoked" } : m,
    );
    data.grants = data.grants.filter((g: any) => g.granteeUserId !== id);
    historyEvent("partner_revoked");
  },
  async invite(input: any) {
    await write();
    data.invitations.push({
      ...togetherInvitationSchema.parse(input),
      id: uuid(),
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    historyEvent("preview_invitation_created_nothing_sent");
  },
  async revokeInvitation(id: string) {
    await write();
    data.invitations.find((i: any) => i.id === id).status = "revoked";
  },
};
export const pregnancyLifecycleRepository = {
  async createUndated() {
    await write();
    data.pregnancy.estimatedDueDate = null;
    data.pregnancy.dueDateSource = "unknown";
    data.hasPregnancy = true;
  },
  async updateDueDate(_owner: string, _pregnancy: string, date: string | null) {
    await write();
    data.pregnancy.estimatedDueDate = date;
    data.pregnancy.dueDateSource = date ? "manual" : "unknown";
  },
  async supportResources() {
    return [];
  },
  async transition(input: any) {
    await write();
    Object.assign(data.pregnancy, {
      lifecycleStatus: input.status,
      postpartumMode: input.postpartumMode,
      compassionateMode: input.compassionateMode,
      statusBeforeArchive:
        input.status === "archived" ? data.pregnancy.lifecycleStatus : null,
    });
  },
};
export const sampleReading = {
  articleId: "fixture-article",
  week: 20,
  title: "Synthetic reviewed reading",
  version: 2,
  body: "PREVIEW FIXTURE — NOT CLINICALLY APPROVED. Keep one question for your next visit. This sample exists only to demonstrate the reading-to-question flow.",
  summary: "Sample planning text for a click-through preview.",
  contentKind: "planning",
  publishedAt: now(),
  reviewedAt: now(),
  reviewerName: "PREVIEW FIXTURE",
  reviewerCredentials: "no clinical approval",
  sources: [],
};
const homePreferences = registerSlice(
  "homePreferences",
  { ...defaultHomePreferences },
  (value) => homePreferencesSchema.safeParse(value).success,
);
export const homePreferencesRepository = {
  async get() {
    return clone(homePreferences);
  },
  async save(_owner: string, value: any) {
    await write();
    const previous = clone(homePreferences);
    Object.assign(homePreferences, homePreferencesSchema.parse(value));
    if (!savePreview()) {
      Object.assign(homePreferences, previous);
      throw new Error("preview_storage_unavailable");
    }
  },
};
function experience() {
  return applyHomePreferences(
    pregnancyExperience({
      status: data.pregnancy.lifecycleStatus,
      postpartumMode: data.pregnancy.postpartumMode,
      compassionateMode: data.pregnancy.compassionateMode,
    }),
    homePreferences,
  );
}
function dating() {
  return derivePregnancyDating({
    estimatedDueDate: data.pregnancy.estimatedDueDate,
    now: new Date(),
    timezone: data.pregnancy.timezone,
  });
}
export const todayJourneyRepository = {
  async getJourney() {
    if (data.hasPregnancy === false) return null;
    return clone({
      pregnancyId,
      pregnancy: data.pregnancy,
      dueDateSource: "manual",
      currentWeek: 20,
      dating: dating(),
      experience: experience(),
      weeks: experience().showWeeklyContent ? [sampleReading] : [],
    });
  },
  async getToday() {
    if (data.hasPregnancy === false) return null;
    return clone({
      homePreferences,
      pregnancyId,
      pregnancy: data.pregnancy,
      dueDateSource: "manual",
      dating: dating(),
      experience: experience(),
      appointment: data.appointments[0] ?? null,
      hiddenModules:
        data.hiddenModulesDate === dating().asOfDate ? data.hiddenModules : [],
      memory: data.entries.find((entry: any) => entry.resurfaceAllowed) ?? null,
      supportRequest:
        state.supportRequests.find((r) => r.status === "open") ?? null,
      content: experience().showWeeklyContent ? sampleReading : null,
    });
  },
  async dismissModuleForToday(_owner: string, key: string, _timezone: string) {
    const date = dating().asOfDate;
    if (data.hiddenModulesDate !== date) data.hiddenModules = [];
    data.hiddenModulesDate = date;
    data.hiddenModules.push(key);
  },
};
const onboardingDrafts = registerSlice(
  "onboardingDrafts",
  { value: null as any },
  (value) => matchesShape(value, { value: null }),
);
export const onboardingDraftStorage = {
  async load() {
    return onboardingDrafts.value
      ? onboardingDraftSchema.parse(clone(onboardingDrafts.value))
      : null;
  },
  async save(_owner: string, value: any) {
    onboardingDrafts.value = onboardingDraftSchema.parse(clone(value));
    if (!savePreview()) throw new Error("preview_storage_unavailable");
  },
  async clear() {
    onboardingDrafts.value = null;
    savePreview();
  },
};
export const onboardingRepository = {
  async complete(value: any) {
    await write();
    const draft = onboardingDraftSchema.parse(value);
    homePreferences.focus = draft.homeFocus;
    data.hasPregnancy = true;
    data.pregnancy.estimatedDueDate = draft.estimatedDueDate || null;
    data.pregnancy.dueDateSource = draft.datingMethod ?? "unknown";
    data.preferences.appointment = draft.appointmentReminders;
    data.preferences.weeklyUpdate = draft.weeklyUpdates;
    savePreview();
  },
};
export const mealRepository = {
  async list(_pregnancy: string, filter: any) {
    return clone(
      data.meals.filter(
        (m: any) =>
          (!filter.mealType || m.mealType === filter.mealType) &&
          (!filter.appetiteResponse ||
            m.appetiteResponse === filter.appetiteResponse) &&
          (filter.wouldEatAgain === null ||
            m.wouldEatAgain === filter.wouldEatAgain),
      ),
    );
  },
  async save(draft: any) {
    await write();
    const updatedAt = now();
    data.meals = data.meals
      .filter((m: any) => m.id !== draft.mealId)
      .concat({ ...draft.values, id: draft.mealId, media: [], updatedAt });
    return { status: "saved", updatedAt };
  },
  async delete(_owner: string, id: string) {
    data.meals = data.meals.filter((m: any) => m.id !== id);
    await mealDraftStorage.remove(ownerId, id);
  },
};
export const checkInRepository = {
  async getContext() {
    return {
      pregnancyId,
      serverDraft: null,
      careTeamPhone: null,
      symptomOptions: [
        { id: uuid(), slug: "tiredness", displayName: "Tiredness" },
      ],
      emotionOptions: [{ id: uuid(), slug: "calm", displayName: "Calm" }],
    };
  },
  async getUrgentGuidance() {
    return [];
  },
  async sync(draft: any, complete: boolean) {
    await write();
    data.checkin = clone(draft);
    return {
      status: "applied",
      checkinId: uuid(),
      updatedAt: now(),
      completedAt: complete ? now() : null,
    };
  },
};
export const notificationPreferencesRepository = {
  async get() {
    return clone(data.preferences);
  },
  async save(_owner: string, input: any) {
    await write();
    data.preferences = clone(input);
  },
};
export const addActionPreferenceRepository = {
  async get() {
    return data.defaultAction;
  },
  async set(_owner: string, value: any) {
    data.defaultAction = value;
  },
};
export const healthSyncRepository = {
  async getState() {
    return { activePlatform: null, storageOptIn: false, storedSummaryCount: 0 };
  },
  async disconnectAndDelete() {},
};
persistMethods(journalRepository, [
  "createTag",
  "save",
  "deleteEntry",
  "saveWeeklyCapsule",
  "deleteMedia",
]);
persistMethods(careRepository, [
  "addQuestion",
  "updateQuestion",
  "addAppointment",
  "addProvider",
  "addContact",
  "addMedication",
  "addMedicationChange",
  "addAppointmentNote",
  "remove",
  "deleteDocument",
]);
persistMethods(togetherRepository, [
  "markNotificationRead",
  "respondToSupportRequest",
]);
persistMethods(partnerSharingService, [
  "setPermissions",
  "setItemOverride",
  "revokePartner",
  "invite",
  "revokeInvitation",
]);
persistMethods(pregnancyLifecycleRepository, [
  "transition",
  "createUndated",
  "updateDueDate",
]);
persistMethods(todayJourneyRepository, ["dismissModuleForToday"]);
persistMethods(mealRepository, ["save", "delete"]);
persistMethods(checkInRepository, ["sync"]);
persistMethods(notificationPreferencesRepository, ["save"]);
persistMethods(addActionPreferenceRepository, ["set"]);
