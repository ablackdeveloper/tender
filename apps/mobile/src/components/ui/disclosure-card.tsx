import { useState, type PropsWithChildren } from "react";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/theme/theme-provider";

export function DisclosureCard({
  title,
  summary,
  children,
}: PropsWithChildren<{ title: string; summary?: string }>) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useTheme();
  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <Button
        variant="ghost"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
      >
        {expanded ? `Hide ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`}
      </Button>
      {summary ? (
        <AppText color="muted" variant="bodySmall">
          {summary}
        </AppText>
      ) : null}
      {expanded ? children : null}
    </Card>
  );
}
