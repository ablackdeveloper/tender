import type { PropsWithChildren } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/app-text";
import { IconButton } from "@/components/ui/icon-button";
import { useTheme } from "@/theme/theme-provider";

export type SheetProps = PropsWithChildren<{
  onClose: () => void;
  title: string;
  visible: boolean;
}>;

export function Sheet({ children, onClose, title, visible }: SheetProps) {
  const { reduceMotionEnabled, theme } = useTheme();

  return (
    <Modal
      animationType={reduceMotionEnabled ? "none" : "slide"}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessible={false}
          onPress={onClose}
          style={{ backgroundColor: theme.colors.scrim, flex: 1 }}
        />
        <SafeAreaView
          accessibilityViewIsModal
          edges={["bottom"]}
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radii.large,
            borderTopRightRadius: theme.radii.large,
            maxHeight: "88%",
            padding: theme.spacing.lg,
            ...theme.elevation.overlay,
          }}
        >
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: theme.spacing.md,
              justifyContent: "space-between",
              marginBottom: theme.spacing.md,
            }}
          >
            <AppText accessibilityRole="header" variant="heading2">
              {title}
            </AppText>
            <IconButton accessibilityLabel="Close" onPress={onClose}>
              <AppText aria-hidden variant="heading2">
                ×
              </AppText>
            </IconButton>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: theme.spacing.sm }}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
