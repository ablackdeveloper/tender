import { useState } from "react";
import { View } from "react-native";

import { AppText, Button, Card, Chip, Field } from "@/components/ui";
import { planTemplates } from "@/features/planning/plan-templates";
import { useTheme } from "@/theme/theme-provider";

export type TemplateSelection = { title: string; tasks: string[] };

export function TemplatePicker({
  onSave,
  disabled = false,
  initialTemplateId,
}: {
  onSave: (selection: TemplateSelection) => Promise<void>;
  disabled?: boolean;
  initialTemplateId?: string | undefined;
}) {
  const { theme } = useTheme();
  const initialTemplate = planTemplates.find((item) => item.id === initialTemplateId);
  const [templateId, setTemplateId] = useState<string | null>(
    initialTemplate?.id ?? null,
  );
  const [title, setTitle] = useState(initialTemplate?.title ?? "");
  const [items, setItems] = useState<{ text: string; included: boolean }[]>(
    () => initialTemplate?.tasks.map((text) => ({ text, included: true })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const selected = items.filter((item) => item.included);
  const templates = [...planTemplates].sort((a, b) =>
    a.id === initialTemplateId ? -1 : b.id === initialTemplateId ? 1 : 0,
  );

  async function save() {
    if (saving || disabled || !title.trim() || !selected.length) return;
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      await onSave({
        title: title.trim(),
        tasks: selected.map((item) => item.text.trim()),
      });
      setTemplateId(null);
      setMessage("Your plan is saved. You can edit or remove tasks below.");
    } catch {
      setFailed(true);
      setMessage(
        "The plan could not be saved. Your choices are still here. Try again when connected.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText variant="heading2">Start with a list</AppText>
      <AppText color="muted">
        Choose a template, then keep only the items you want.
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
        {templates.map((template) => (
          <Chip
            key={template.id}
            selected={templateId === template.id}
            disabled={saving}
            onPress={() => {
              setTemplateId(template.id);
              setTitle(template.title);
              setItems(template.tasks.map((text) => ({ text, included: true })));
              setMessage("");
            }}
          >
            {template.title}
          </Chip>
        ))}
      </View>
      {templateId ? (
        <>
          <AppText color="muted">
            {planTemplates.find((item) => item.id === templateId)?.description}
          </AppText>
          <Field
            label="Plan title"
            value={title}
            maxLength={240}
            editable={!saving}
            onChangeText={setTitle}
          />
          {items.map((item, index) => (
            <View key={index} style={{ gap: theme.spacing.xs }}>
              <Chip
                selected={item.included}
                disabled={saving}
                accessibilityLabel={`${item.included ? "Exclude" : "Include"} item ${index + 1}`}
                onPress={() =>
                  setItems((current) =>
                    current.map((entry, position) =>
                      position === index
                        ? { ...entry, included: !entry.included }
                        : entry,
                    ),
                  )
                }
              >
                {item.included ? "Included" : "Not included"}
              </Chip>
              <Field
                label={`Item ${index + 1}`}
                value={item.text}
                maxLength={240}
                editable={!saving}
                onChangeText={(text) =>
                  setItems((current) =>
                    current.map((entry, position) =>
                      position === index ? { ...entry, text } : entry,
                    ),
                  )
                }
              />
            </View>
          ))}
          <AppText color="muted" variant="bodySmall">
            These tasks use your existing task-sharing settings. Review access in
            Together before adding sensitive details.
          </AppText>
          <Button
            loading={saving}
            disabled={
              disabled ||
              !title.trim() ||
              !selected.length ||
              selected.some((item) => !item.text.trim())
            }
            onPress={() => void save()}
          >
            Save selected tasks
          </Button>
        </>
      ) : null}
      {message ? (
        <AppText accessibilityLiveRegion="polite" color={failed ? "danger" : "muted"}>
          {message}
        </AppText>
      ) : null}
    </Card>
  );
}
