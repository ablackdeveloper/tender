import { create } from "zustand";

type DraftState = {
  activeDraftId: string | null;
  isDirty: boolean;
  beginDraft: (draftId: string) => void;
  markDirty: () => void;
  clearDraft: () => void;
};

export const useDraftStore = create<DraftState>((set) => ({
  activeDraftId: null,
  isDirty: false,
  beginDraft: (draftId) => set({ activeDraftId: draftId, isDirty: false }),
  markDirty: () => set({ isDirty: true }),
  clearDraft: () => set({ activeDraftId: null, isDirty: false }),
}));
