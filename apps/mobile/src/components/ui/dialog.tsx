import type { PropsWithChildren, ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/app-text";
import { IconButton } from "@/components/ui/icon-button";
import { useTheme } from "@/theme/theme-provider";

export type DialogProps = PropsWithChildren<{
  actions?: ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}>;

export function Dialog({ actions, children, onClose, title, visible }: DialogProps) {
  const insets = useSafeAreaInsets();
  const { reduceMotionEnabled, theme } = useTheme();

  return (
    <Modal
      animationType={reduceMotionEnabled ? "none" : "fade"}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View
        style={{
          backgroundColor: theme.colors.scrim,
          flex: 1,
          justifyContent: "center",
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
          paddingHorizontal: theme.spacing.lg,
          paddingTop: Math.max(insets.top, theme.spacing.lg),
        }}
      >
        <Pressable
          accessible={false}
          onPress={onClose}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.large,
            gap: theme.spacing.md,
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
          {children}
          {actions ? (
            <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
              {actions}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
