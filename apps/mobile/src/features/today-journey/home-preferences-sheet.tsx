import { useState } from "react";
import { View } from "react-native";
import { AppText, Button, Chip, Sheet } from "@/components/ui";
import { useTheme } from "@/theme/theme-provider";
import { homeFocusOptions, type HomePreferences } from "./home-preferences";

export function HomePreferencesSheet({
  initial,
  isOffline,
  onClose,
  onSave,
}: {
  initial: HomePreferences;
  isOffline: boolean;
  onClose: () => void;
  onSave: (value: HomePreferences) => Promise<void>;
}) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onSave(draft);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible
      title="Today preferences"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <AppText variant="heading3">Home focus</AppText>
      <AppText color="muted">
        Choose a starting point. Upcoming visits and active support requests still come
        first.
      </AppText>
      <View style={{ gap: theme.spacing.sm }}>
        {homeFocusOptions.map((option) => (
          <Chip
            key={option.value}
            disabled={busy}
            selected={draft.focus === option.value}
            onPress={() => setDraft({ ...draft, focus: option.value })}
          >
            {option.label}
          </Chip>
        ))}
      </View>
      <AppText variant="heading3">Content you see</AppText>
      <AppText color="muted">
        Each choice is separate. Compassionate mode and pregnancy status can hide more
        content.
      </AppText>
      {(
        [
          ["showWeeklyContent", "Show weekly reading"],
          ["showDueDate", "Show due-date wording"],
          ["showProgressCounts", "Show progress counts"],
          ["showSizeComparisons", "Show size comparisons"],
        ] as const
      ).map(([key, label]) => (
        <Chip
          key={key}
          disabled={busy}
          selected={draft[key]}
          onPress={() => setDraft({ ...draft, [key]: !draft[key] })}
        >
          {label}
        </Chip>
      ))}
      <AppText color="muted" variant="caption">
        These choices apply to Today and Journey. Dates stay available in pregnancy
        settings. Size comparisons are not currently available.
      </AppText>
      {isOffline ? <AppText>Connect to save these choices.</AppText> : null}
      {failed ? (
        <AppText accessibilityRole="alert" color="danger">
          Preferences could not be saved. Your choices are still here. Try again.
        </AppText>
      ) : null}
      <Button disabled={isOffline} loading={busy} onPress={() => void save()}>
        Save preferences
      </Button>
      <Button disabled={busy} variant="ghost" onPress={onClose}>
        Cancel
      </Button>
    </Sheet>
  );
}
