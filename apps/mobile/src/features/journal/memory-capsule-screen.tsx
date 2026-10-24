import { useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/layout/screen";
import { AppText, Button, Card, Chip, EmptyState, ErrorState } from "@/components/ui";
import { mondayForDate, toggleCapsuleEntry } from "@/features/journal/memory-capsule";
import {
  journalKeys,
  useJournalContext,
  useJournalEntries,
} from "@/features/journal/queries";
import { useAuth } from "@/providers/auth-provider";
import { useTodayQuery } from "@/features/today-journey/queries";
import { journalRepository } from "@/repositories/journal-repository";
import { useTheme } from "@/theme/theme-provider";

export function MemoryCapsuleScreen() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const context = useJournalContext(ownerId);
  const today = useTodayQuery(ownerId);
  const pregnancy = today.data?.pregnancy;
  const canResurface =
    !today.isError &&
    Boolean(
      pregnancy &&
      !pregnancy.compassionateMode &&
      ["active", "paused"].includes(pregnancy.lifecycleStatus),
    );
  const pregnancyId = context.data?.pregnancyId ?? "";
  const entries = useJournalEntries(ownerId, pregnancyId, "", false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const eligible = entries.data?.filter((entry) => entry.resurfaceAllowed) ?? [];

  async function save() {
    if (!canResurface || !pregnancyId || selected.length === 0) return;
    setSaving(true);
    setError(false);
    try {
      await journalRepository.saveWeeklyCapsule({
        entryIds: selected,
        ownerId,
        pregnancyId,
        title: "This week's moments",
        weekStart: mondayForDate(new Date()),
      });
      await queryClient.invalidateQueries({ queryKey: journalKeys.all });
      router.replace("/(app)/memories" as Href);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!canResurface)
    return (
      <Screen>
        <EmptyState
          title="Memory suggestions are paused"
          description="Your saved memories are still available in Memories."
        />
        <Button onPress={() => router.replace("/(app)/memories" as Href)}>
          Open Memories
        </Button>
      </Screen>
    );

  return (
    <Screen
      footer={
        <Button
          disabled={selected.length === 0}
          loading={saving}
          onPress={() => void save()}
        >
          Save {selected.length || ""} moment{selected.length === 1 ? "" : "s"}
        </Button>
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <AppText accessibilityRole="header" variant="heading1">
          This week&apos;s moments
        </AppText>
        <AppText color="muted">
          Choose up to five memories. Only entries that you marked for resurfacing
          appear here. Saving this capsule does not share it.
        </AppText>
      </View>
      {error ? (
        <ErrorState
          description="Your selection is still on this screen. Review it and try again."
          title="Capsule not saved"
        />
      ) : null}
      {eligible.length === 0 ? (
        <EmptyState
          description="Open a memory and turn on gentle memory moments first."
          title="No eligible memories"
        />
      ) : (
        eligible.map((entry) => (
          <Card key={entry.id} style={{ gap: theme.spacing.xs }}>
            <AppText variant="heading3">{entry.title || "A private moment"}</AppText>
            <AppText numberOfLines={3}>{entry.body}</AppText>
            <Chip
              onPress={() =>
                setSelected((current) => toggleCapsuleEntry(current, entry.id))
              }
              selected={selected.includes(entry.id)}
            >
              {selected.includes(entry.id) ? "Selected" : "Include"}
            </Chip>
          </Card>
        ))
      )}
      <AppText color="muted" variant="caption">
        Flutterings does not analyze memory text or decide which moments belong here.
      </AppText>
    </Screen>
  );
}
