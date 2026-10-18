import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  OfflineState,
  PrivacyBadge,
  SafetyCallout,
  SegmentedControl,
  Sheet,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/ui";
import { useTheme, type ThemePreference } from "@/theme/theme-provider";

const themeOptions = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

export default function ComponentGallery() {
  const [chipSelected, setChipSelected] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const { preference, reduceMotionEnabled, setPreference, theme } = useTheme();
  const toast = useToast();

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="displayL">
        Component gallery
      </AppText>
      <AppText color="muted" variant="bodySmall">
        Development only · Dynamic Type on · Reduced motion{" "}
        {reduceMotionEnabled ? "on" : "off"}
      </AppText>

      <GallerySection title="Theme">
        <SegmentedControl<ThemePreference>
          accessibilityLabel="Theme preference"
          onChange={setPreference}
          options={themeOptions}
          value={preference}
        />
      </GallerySection>

      <GallerySection title="Typography">
        <AppText variant="displayXL">Display XL</AppText>
        <AppText variant="heading1">Heading one</AppText>
        <AppText variant="heading2">Heading two</AppText>
        <AppText variant="bodyLarge">Body large supports Dynamic Type.</AppText>
        <AppText variant="body">Body text stays readable and calm.</AppText>
        <AppText color="muted" variant="caption">
          CAPTION AND METADATA
        </AppText>
      </GallerySection>

      <GallerySection title="Actions">
        <Button
          onPress={() => toast.show({ message: "Saved privately", tone: "success" })}
        >
          Primary action
        </Button>
        <Button variant="secondary">Secondary action</Button>
        <Button variant="ghost">Quiet action</Button>
        <Button variant="danger">Destructive action</Button>
        <Button loading>Saving</Button>
        <IconButton accessibilityLabel="Add item">
          <AppText aria-hidden variant="heading2">
            +
          </AppText>
        </IconButton>
      </GallerySection>

      <GallerySection title="Inputs">
        <Field
          hint="Stored privately by default."
          label="Name"
          placeholder="Enter a name"
        />
        <Field error="Review this value." label="Field with error" value="Example" />
        <Textarea label="Private note" placeholder="Write a note" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          <Chip
            onPress={() => setChipSelected((selected) => !selected)}
            selected={chipSelected}
          >
            Selected chip
          </Chip>
          <Chip>Choice</Chip>
        </View>
      </GallerySection>

      <GallerySection title="Surfaces and status">
        <Card>
          <AppText>Outlined card</AppText>
        </Card>
        <Card elevated>
          <AppText>Elevated card</AppText>
        </Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          <PrivacyBadge level="private" />
          <PrivacyBadge level="shared" />
          <PrivacyBadge level="care-team" />
        </View>
        <SafetyCallout>
          This companion offers general information and never diagnoses.
        </SafetyCallout>
        <SafetyCallout urgent>
          If you may be in immediate danger, contact local emergency services.
        </SafetyCallout>
        <Skeleton height={24} />
      </GallerySection>

      <GallerySection title="Overlays">
        <Button onPress={() => setSheetVisible(true)} variant="ghost">
          Open sheet
        </Button>
        <Button onPress={() => setDialogVisible(true)} variant="ghost">
          Open dialog
        </Button>
      </GallerySection>

      <GallerySection title="States">
        <EmptyState
          description="Create an item when you’re ready."
          title="Nothing here yet"
        />
        <ErrorState
          actionLabel="Try again"
          description="Your private data was not changed."
          onAction={() => toast.show({ message: "Trying again" })}
          title="Something went wrong"
        />
        <OfflineState description="Reconnect to refresh server data." />
      </GallerySection>

      <Sheet
        onClose={() => setSheetVisible(false)}
        title="Example sheet"
        visible={sheetVisible}
      >
        <AppText>Sheet content respects bottom safe-area insets.</AppText>
      </Sheet>
      <Dialog
        actions={<Button onPress={() => setDialogVisible(false)}>Close</Button>}
        onClose={() => setDialogVisible(false)}
        title="Example dialog"
        visible={dialogVisible}
      >
        <AppText>Dialogs use semantic surfaces and accessible modal semantics.</AppText>
      </Dialog>
    </Screen>
  );
}

function GallerySection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText accessibilityRole="header" variant="heading2">
        {title}
      </AppText>
      {children}
    </View>
  );
}
