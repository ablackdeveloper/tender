import { usePathname, useRouter } from "expo-router";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/theme-provider";
import { AppText } from "@/components/ui/app-text";
import { useOptionalAuth } from "@/providers/auth-provider";

type ScreenProps = PropsWithChildren<{
  contentContainerStyle?: ComponentProps<typeof ScrollView>["contentContainerStyle"];
  footer?: ReactNode;
}>;

export function Screen({ children, contentContainerStyle, footer }: ScreenProps) {
  const { theme } = useTheme();
  const session = useOptionalAuth()?.session;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SafeAreaView style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          {
            flexGrow: 1,
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
          },
          contentContainerStyle,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {session && pathname !== "/get-help" ? (
          <Pressable
            accessibilityLabel="Open Get Help"
            accessibilityRole="button"
            onPress={() => router.push("/get-help")}
            style={({ pressed }) => ({
              alignItems: "center",
              alignSelf: "flex-end",
              borderColor: theme.colors.danger,
              borderRadius: theme.radii.full,
              borderWidth: 1,
              justifyContent: "center",
              minHeight: theme.sizes.minimumTarget,
              minWidth: theme.sizes.minimumTarget,
              opacity: pressed ? 0.75 : 1,
              paddingHorizontal: theme.spacing.md,
            })}
          >
            <AppText color="danger" variant="heading3">
              Get Help
            </AppText>
          </Pressable>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        <View
          accessibilityRole="toolbar"
          style={{
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            paddingBottom: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
