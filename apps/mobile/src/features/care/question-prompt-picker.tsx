import { useState } from "react";
import { View } from "react-native";
import { AppText, Button, Card, Chip } from "@/components/ui";
import { questionPromptGroups } from "@/features/care/question-prompts";
import { useTheme } from "@/theme/theme-provider";

export function QuestionPromptPicker({
  onChoose,
  disabled = false,
}: {
  onChoose: (question: string) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const [groupId, setGroupId] = useState<string | null>(null);
  const group = questionPromptGroups.find((item) => item.id === groupId);
  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText variant="heading2">Need a starting point?</AppText>
      <AppText color="muted">
        Optional conversation starters. Choose one and edit it in your own words. These
        do not give medical advice.
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
        {questionPromptGroups.map((item) => (
          <Chip
            key={item.id}
            selected={groupId === item.id}
            disabled={disabled}
            onPress={() => setGroupId(groupId === item.id ? null : item.id)}
          >
            {item.label}
          </Chip>
        ))}
      </View>
      {group?.questions.map((question) => (
        <Button
          key={question}
          variant="ghost"
          disabled={disabled}
          onPress={() => onChoose(question)}
        >
          {question}
        </Button>
      ))}
    </Card>
  );
}
