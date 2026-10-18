export type DeletableMedia = { id: string; objectPath: string; ready: boolean };

export async function permanentlyDeleteJournalEntry(input: {
  deleteEntryRow: () => Promise<void>;
  deleteMediaRow: (id: string) => Promise<void>;
  media: readonly DeletableMedia[];
  removePrivateObject: (path: string) => Promise<void>;
}): Promise<void> {
  for (const asset of input.media) {
    // Storage first: a failed object deletion must never hide metadata and
    // create a silent orphan that the user believes was permanently removed.
    if (asset.ready) await input.removePrivateObject(asset.objectPath);
    await input.deleteMediaRow(asset.id);
  }
  await input.deleteEntryRow();
}
