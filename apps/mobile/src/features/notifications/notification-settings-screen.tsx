import { useEffect, useState } from "react";
import { Switch, View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  ErrorState,
  Field,
  PrivacyBadge,
  SafetyCallout,
  Skeleton,
  Sheet,
} from "@/components/ui";
import type { NotificationPreferences } from "@/features/notifications/types";
import { notificationPreferencesRepository } from "@/repositories/notification-preferences-repository";
import { notificationScheduleSchema } from "@/schemas/notifications";
import { notificationService } from "@/services/notifications/notification-service";
import { useTheme } from "@/theme/theme-provider";

const categoryRows: {
  key: keyof Pick<
    NotificationPreferences,
    "appointment" | "medicationAsRecorded" | "weeklyUpdate" | "photo" | "partnerRequest"
  >;
  label: string;
  description: string;
}[] = [
  {
    key: "appointment",
    label: "Appointments",
    description: "One reminder for a recorded appointment.",
  },
  {
    key: "medicationAsRecorded",
    label: "Medication—as recorded",
    description:
      "A neutral prompt to update your record; never advice to take, stop, or change medication.",
  },
  {
    key: "weeklyUpdate",
    label: "Weekly update",
    description: "One reviewed weekly-content update.",
  },
  {
    key: "photo",
    label: "Photos",
    description: "A gentle photo-series reminder when enabled.",
  },
  {
    key: "partnerRequest",
    label: "Partner requests",
    description: "A notice when someone explicitly requests support or access changes.",
  },
];

export function NotificationSettingsScreen({ ownerId }: { ownerId: string }) {
  const { theme } = useTheme();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoneVisible, setZoneVisible] = useState(false);
  const [zoneSearch, setZoneSearch] = useState("");
  const timezoneApi = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  const zones = [
    ...new Set([
      "UTC",
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      preferences?.timezone ?? "UTC",
      ...(timezoneApi.supportedValuesOf?.("timeZone") ?? []),
    ]),
  ];
  useEffect(() => {
    let active = true;
    void notificationPreferencesRepository
      .get(ownerId)
      .then((value) => {
        if (active) setPreferences(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [ownerId]);
  if (!preferences)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading notification settings" height={280} />
      </Screen>
    );
  async function save() {
    setBusy(true);
    setError(false);
    setMessage(null);
    try {
      const schedule = notificationScheduleSchema.safeParse(preferences);
      if (!schedule.success) {
        setError(true);
        setMessage(
          schedule.error.issues[0]?.message ?? "Review quiet hours and timezone.",
        );
        return;
      }
      await notificationPreferencesRepository.save(ownerId, preferences!);
      setMessage("Notification choices saved.");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function enable() {
    setBusy(true);
    setError(false);
    setMessage(null);
    try {
      const result = await notificationService.registerAfterUserAction();
      setMessage(
        result.status === "registered"
          ? "This device is registered for the categories you selected."
          : result.status === "denied"
            ? "Notifications remain off in system settings."
            : result.status === "not-configured"
              ? "Push delivery needs an EAS project ID in this build."
              : result.status === "simulator"
                ? "Push registration requires a physical device."
                : "Push notifications are not supported on this platform.",
      );
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <AppText accessibilityRole="header" variant="heading1">
        Notifications
      </AppText>
      <PrivacyBadge level="private" />
      <AppText variant="label">Generic on lock screen by default</AppText>
      <AppText color="muted">
        Choose categories independently. Flutterings does not use streaks, guilt,
        repeated nagging, or symptom details in notification content.
      </AppText>
      {error ? (
        <ErrorState
          title="Settings not saved"
          description={message ?? "Your previous choices remain in effect."}
        />
      ) : null}
      {message && !error ? (
        <AppText accessibilityLiveRegion="polite" color="success">
          {message}
        </AppText>
      ) : null}
      <Card style={{ gap: theme.spacing.md }}>
        {categoryRows.map((row) => (
          <View
            key={row.key}
            style={{
              flexDirection: "row",
              gap: theme.spacing.sm,
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: theme.sizes.minimumTarget,
            }}
          >
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <AppText variant="heading3">{row.label}</AppText>
              <AppText color="muted" variant="bodySmall">
                {row.description}
              </AppText>
            </View>
            <Switch
              accessibilityLabel={`${row.label} notifications`}
              accessibilityRole="switch"
              accessibilityState={{ checked: preferences[row.key] }}
              value={preferences[row.key]}
              onValueChange={(value) =>
                setPreferences((current) =>
                  current ? { ...current, [row.key]: value } : current,
                )
              }
            />
          </View>
        ))}
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Lock-screen privacy</AppText>
        <AppText>Default: “You have an update in Flutterings.”</AppText>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: theme.sizes.minimumTarget,
          }}
        >
          <AppText style={{ flex: 1 }}>
            Allow category-specific pregnancy-revealing wording
          </AppText>
          <Switch
            accessibilityLabel="Allow pregnancy-revealing notification content"
            accessibilityRole="switch"
            accessibilityState={{ checked: preferences.revealingContent }}
            value={preferences.revealingContent}
            onValueChange={(revealingContent) =>
              setPreferences((current) =>
                current ? { ...current, revealingContent } : current,
              )
            }
          />
        </View>
        <SafetyCallout title="Private destination check">
          Opening a notification sends only its opaque ID to Flutterings. The
          destination is reauthorized with your current session before navigation.
        </SafetyCallout>
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Quiet hours</AppText>
        <Field
          label="Start (24-hour HH:MM)"
          value={preferences.quietHoursStart ?? ""}
          onChangeText={(value) =>
            setPreferences((current) =>
              current ? { ...current, quietHoursStart: value || null } : current,
            )
          }
        />
        <Field
          label="End (24-hour HH:MM)"
          value={preferences.quietHoursEnd ?? ""}
          onChangeText={(value) =>
            setPreferences((current) =>
              current ? { ...current, quietHoursEnd: value || null } : current,
            )
          }
        />
        <AppText variant="label">Time zone</AppText>
        <Button
          variant="secondary"
          accessibilityLabel="Choose time zone"
          onPress={() => setZoneVisible(true)}
        >
          {preferences.timezone.replaceAll("_", " ")}
        </Button>
        <Sheet
          title="Choose time zone"
          visible={zoneVisible}
          onClose={() => setZoneVisible(false)}
        >
          <Field
            label="Find a city or region"
            value={zoneSearch}
            onChangeText={setZoneSearch}
          />
          {zones
            .filter((zone) =>
              zone
                .replaceAll("_", " ")
                .toLowerCase()
                .includes(zoneSearch.toLowerCase()),
            )
            .slice(0, 20)
            .map((timezone) => (
              <Button
                key={timezone}
                variant="ghost"
                onPress={() => {
                  setPreferences((current) =>
                    current ? { ...current, timezone } : current,
                  );
                  setZoneVisible(false);
                }}
              >
                {timezone.replaceAll("_", " ")}
              </Button>
            ))}
          <AppText color="muted">
            Search to narrow the list. Quiet hours use the selected time zone.
          </AppText>
        </Sheet>
      </Card>
      <Button loading={busy} onPress={() => void save()}>
        Save choices
      </Button>
      <Button loading={busy} variant="secondary" onPress={() => void enable()}>
        Enable notifications on this device
      </Button>
    </Screen>
  );
}
