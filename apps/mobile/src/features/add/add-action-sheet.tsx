import { View } from "react-native";

import { AppText, Button, Chip, Sheet } from "@/components/ui";
import type { AddActionKey } from "@/repositories/add-action-preference-repository";
import { useTheme } from "@/theme/theme-provider";

export type AddAction = {
  description: string;
  key: AddActionKey;
  label: string;
  onPress: () => void;
};

export function AddActionSheet({
  actions,
  defaultAction,
  defaultError,
  onClose,
  onDefaultChange,
  visible,
}: {
  actions: AddAction[];
  defaultAction: AddActionKey | null;
  defaultError: boolean;
  onClose: () => void;
  onDefaultChange: (action: AddActionKey | null) => Promise<void>;
  visible: boolean;
}) {
  const { theme } = useTheme();

  return (
    <Sheet onClose={onClose} title="Add" visible={visible}>
      <View style={{ gap: theme.spacing.md }}>
        <AppText color="muted">
          Choose one small action. You can stop after it is saved.
        </AppText>
        {defaultError ? (
          <AppText color="danger" variant="caption">
            The default choice could not be changed. Try again when connected.
          </AppText>
        ) : null}
        {actions.map((action) => (
          <View key={action.label} style={{ gap: theme.spacing.xxs }}>
            <Button onPress={action.onPress} variant="secondary">
              {action.label}
            </Button>
            <AppText color="muted" variant="caption">
              {action.description}
            </AppText>
            <Chip
              onPress={() =>
                void onDefaultChange(defaultAction === action.key ? null : action.key)
              }
              selected={defaultAction === action.key}
            >
              {defaultAction === action.key ? "Default" : "Make default"}
            </Chip>
          </View>
        ))}
        <AppText color="muted" variant="caption">
          A default opens when you tap Add. Press and hold Add to see every choice.
          Flutterings never changes this setting for you.
        </AppText>
      </View>
    </Sheet>
  );
}
