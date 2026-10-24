import { AppText, Button, Card } from "@/components/ui";
import { useTheme } from "@/theme/theme-provider";

export type RecoveryAction =
  "care" | "question" | "plan" | "support" | "reflection" | "memories";

export const recoveryReflectionPrompts = [
  "What would I like to remember about today?",
  "What help would make tomorrow easier?",
  "What would I like to discuss with my care team?",
] as const;

export function RecoveryView({
  onAction,
  appointmentLabel,
}: {
  onAction: (action: RecoveryAction) => void;
  appointmentLabel?: string | undefined;
}) {
  const { theme } = useTheme();
  return (
    <>
      <AppText accessibilityRole="header" variant="heading1">
        Support after birth
      </AppText>
      <AppText color="muted">
        A space for your questions, practical help, and private reflections. Your
        pregnancy memories stay available.
      </AppText>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Your next care conversation</AppText>
        <AppText>
          {appointmentLabel ??
            "Add an appointment using the follow-up plan from your care team."}
        </AppText>
        <Button onPress={() => onAction(appointmentLabel ? "question" : "care")}>
          {appointmentLabel ? "Prepare a question" : "Open appointments"}
        </Button>
        <Button variant="ghost" onPress={() => onAction("care")}>
          Review care records
        </Button>
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Make room for help</AppText>
        <AppText color="muted">
          Plan meals, household tasks, transport, or quiet time. Share only what you
          choose.
        </AppText>
        <Button variant="secondary" onPress={() => onAction("plan")}>
          Build my support plan
        </Button>
        <Button variant="ghost" onPress={() => onAction("support")}>
          Ask for practical help
        </Button>
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">A moment for you</AppText>
        <AppText color="muted">
          A short note is enough. You can use a prompt or write freely.
        </AppText>
        <Button variant="secondary" onPress={() => onAction("reflection")}>
          Write a private reflection
        </Button>
        <Button variant="ghost" onPress={() => onAction("memories")}>
          Open my memories
        </Button>
      </Card>
    </>
  );
}
