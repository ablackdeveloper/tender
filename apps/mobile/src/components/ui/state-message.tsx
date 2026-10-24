import type { ReactNode } from "react";
import { View } from "react-native";

import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/theme/theme-provider";

type StateMessageProps = {
  actionLabel?: string;
  description: string;
  icon?: ReactNode;
  onAction?: () => void;
  title: string;
  tone?: "default" | "danger" | "warning";
};

function StateMessage({
  actionLabel,
  description,
  icon,
  onAction,
  title,
  tone = "default",
}: StateMessageProps) {
  const { theme } = useTheme();
  const color =
    tone === "danger" ? "danger" : tone === "warning" ? "warning" : "default";

  return (
    <View
      style={{
        alignItems: "center",
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
      }}
    >
      {icon}
      <AppText
        accessibilityLiveRegion={tone === "danger" ? "assertive" : "polite"}
        accessibilityRole="header"
        color={color}
        style={{ textAlign: "center" }}
        variant="heading2"
      >
        {title}
      </AppText>
      <AppText color="muted" style={{ textAlign: "center" }} variant="bodySmall">
        {description}
      </AppText>
      {actionLabel && onAction ? (
        <Button onPress={onAction} variant={tone === "danger" ? "danger" : "secondary"}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

export type EmptyStateProps = Pick<
  StateMessageProps,
  "actionLabel" | "description" | "icon" | "onAction" | "title"
>;

export function EmptyState(props: EmptyStateProps) {
  return <StateMessage {...props} />;
}

export type ErrorStateProps = EmptyStateProps;

export function ErrorState(props: ErrorStateProps) {
  return <StateMessage {...props} tone="danger" />;
}

export type OfflineStateProps = Omit<EmptyStateProps, "title"> & { title?: string };

export function OfflineState({
  title = "You’re offline",
  ...props
}: OfflineStateProps) {
  return <StateMessage {...props} title={title} tone="warning" />;
}
