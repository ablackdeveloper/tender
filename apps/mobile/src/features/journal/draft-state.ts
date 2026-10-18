import type { JournalDraft, MediaUploadJob } from "@/schemas/journal";

export function createJournalDraft(input: {
  entryId: string;
  now: string;
  pregnancyId: string;
}): JournalDraft {
  return {
    baseServerUpdatedAt: null,
    body: "",
    entryAt: input.now,
    entryId: input.entryId,
    isFavorite: false,
    media: [],
    pregnancyId: input.pregnancyId,
    privacy: "private",
    resurfaceAllowed: false,
    status: "dirty",
    tagIds: [],
    title: "",
    updatedAt: input.now,
    version: 1,
  };
}

export function updateJournalDraft(
  draft: JournalDraft,
  patch: Partial<
    Pick<
      JournalDraft,
      | "body"
      | "entryAt"
      | "isFavorite"
      | "privacy"
      | "resurfaceAllowed"
      | "tagIds"
      | "title"
    >
  >,
  now: string,
): JournalDraft {
  return { ...draft, ...patch, status: "dirty", updatedAt: now };
}

export function updateMediaJob(
  draft: JournalDraft,
  job: MediaUploadJob,
  now: string,
): JournalDraft {
  const otherJobs = draft.media.filter(
    (candidate) => candidate.assetId !== job.assetId,
  );
  return { ...draft, media: [...otherJobs, job], updatedAt: now };
}

export function applyMediaFailure(
  draft: JournalDraft,
  assetId: string,
  errorCode: string,
  now: string,
): JournalDraft {
  return {
    ...draft,
    media: draft.media.map((job) =>
      job.assetId === assetId ? { ...job, errorCode, status: "failed" as const } : job,
    ),
    // Text and entry save status are intentionally untouched by media failures.
    updatedAt: now,
  };
}

export function applyJournalSave(
  draft: JournalDraft,
  result: { status: "conflict" | "saved"; updatedAt: string },
): JournalDraft {
  if (result.status === "conflict") return { ...draft, status: "conflict" };
  return {
    ...draft,
    baseServerUpdatedAt: result.updatedAt,
    status: "saved",
    updatedAt: result.updatedAt,
  };
}

export function chooseJournalDraft(
  local: JournalDraft | null,
  server: JournalDraft | null,
): JournalDraft | null {
  if (!local) return server;
  if (!server) return local;
  if (local.status === "dirty" || local.status === "conflict") return local;
  return Date.parse(server.updatedAt) >= Date.parse(local.updatedAt) ? server : local;
}
