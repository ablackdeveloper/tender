import { View } from "react-native";

import { AppText, Card, Skeleton } from "@/components/ui";
import { useTheme } from "@/theme/theme-provider";

export function OfflineCacheNotice() {
  const { theme } = useTheme();
  return (
    <Card
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.colors.warningSurface,
        padding: theme.spacing.md,
      }}
    >
      <AppText color="warning" variant="bodySmall">
        Offline — showing saved results from this session. Reconnect to refresh.
      </AppText>
    </Card>
  );
}

export function ProductSkeleton({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View accessibilityLabel={label} style={{ gap: theme.spacing.md }}>
      <Skeleton height={18} width="35%" />
      <Skeleton height={52} width="70%" />
      <Skeleton height={88} />
      <Skeleton height={144} />
      <Skeleton height={88} />
    </View>
  );
}
