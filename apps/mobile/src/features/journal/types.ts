import type { JournalDraft, JournalPrivacy, MediaUploadJob } from "@/schemas/journal";

export type JournalTag = { id: string; name: string };
export type JournalMedia = {
  id: string;
  kind: MediaUploadJob["kind"];
  mimeType: string;
  status: "deleted" | "failed" | "pending" | "ready";
};
export type JournalEntry = {
  body: string;
  entryAt: string;
  id: string;
  isFavorite: boolean;
  media: JournalMedia[];
  pregnancyId: string;
  privacy: JournalPrivacy;
  resurfaceAllowed: boolean;
  tags: JournalTag[];
  title: string;
  updatedAt: string;
};
export type JournalContext = {
  drafts: JournalDraft[];
  entries: JournalEntry[];
  pregnancyId: string;
  tags: JournalTag[];
};
