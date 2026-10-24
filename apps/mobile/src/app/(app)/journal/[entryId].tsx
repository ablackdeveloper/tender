import { useLocalSearchParams } from "expo-router";
import { z } from "zod";

import { Screen } from "@/components/layout/screen";
import { ErrorState, Skeleton } from "@/components/ui";
import { JournalEditorScreen } from "@/features/journal/journal-editor-screen";
import { useJournalContext } from "@/features/journal/queries";
import { useAuth } from "@/providers/auth-provider";

export default function JournalEntryRoute() {
  const { entryId, reflection } = useLocalSearchParams<{
    entryId: string;
    reflection?: string;
  }>();
  const { session } = useAuth();
  const ownerId = session?.user.id ?? "";
  const context = useJournalContext(ownerId);
  if (context.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading journal context" height={200} />
      </Screen>
    );
  if (
    context.isError ||
    !context.data?.pregnancyId ||
    (entryId !== "new" && !z.uuid().safeParse(entryId).success)
  ) {
    return (
      <Screen>
        <ErrorState
          description="The journal entry could not be opened."
          title="Unable to open entry"
        />
      </Screen>
    );
  }
  return (
    <JournalEditorScreen
      reflectionMode={reflection === "recovery" && entryId === "new"}
      entryId={entryId}
      ownerId={ownerId}
      pregnancyId={context.data.pregnancyId}
      tags={context.data.tags}
    />
  );
}
