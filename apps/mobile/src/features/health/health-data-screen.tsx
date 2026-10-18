import { useEffect, useState } from "react";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Dialog,
  ErrorState,
  SafetyCallout,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import {
  healthSyncRepository,
  type HealthSyncState,
} from "@/repositories/health-sync-repository";
import {
  healthDataRepository,
  type HealthAvailability,
} from "@/services/health/health-data-repository";
import { useTheme } from "@/theme/theme-provider";

export function HealthDataScreen() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [syncState, setSyncState] = useState<HealthSyncState | null>(null);
  const [error, setError] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ownerId = session?.user.id ?? "";

  useEffect(() => {
    void healthDataRepository.availability().then(setAvailability);
    if (ownerId) {
      void healthSyncRepository
        .getState(ownerId)
        .then(setSyncState)
        .catch(() => setError(true));
    }
  }, [ownerId]);

  async function disconnectAndDelete() {
    setDeleteVisible(false);
    setDeleting(true);
    setError(false);
    try {
      await healthSyncRepository.disconnectAndDelete();
      setSyncState(await healthSyncRepository.getState(ownerId));
    } catch {
      setError(true);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="heading1">
        Health data
      </AppText>
      <AppText color="muted">
        Health data is optional. Flutterings will ask only after you choose a data type.
      </AppText>
      {!availability ? (
        <Skeleton accessibilityLabel="Checking health data support" height={120} />
      ) : (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading2">
            {availability.available ? "Available on this device" : "Not active yet"}
          </AppText>
          <AppText>
            {availability.available
              ? "You can choose sleep, steps, workouts, or mindfulness."
              : availability.reason === "unsupported_platform"
                ? "Phone health data is not available on this platform."
                : "This build does not include the reviewed native health adapter. No permission was requested and no health data was read."}
          </AppText>
        </Card>
      )}
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Planned read-only data</AppText>
        <AppText>Sleep duration · Steps · Workout duration · Mindfulness time</AppText>
        <AppText color="muted" variant="bodySmall">
          Raw samples stay on the device. Server summaries require a separate opt-in.
        </AppText>
      </Card>
      {error ? (
        <ErrorState
          description="No health permission or stored summary was changed. Try again when connected."
          title="Health settings unavailable"
        />
      ) : null}
      {syncState?.activePlatform ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading2">Connected health source</AppText>
          <AppText>
            {syncState.activePlatform === "apple_health"
              ? "Apple Health"
              : "Health Connect"}
          </AppText>
          <AppText color="muted" variant="bodySmall">
            {syncState.storageOptIn
              ? `${syncState.storedSummaryCount} daily summaries are stored in Flutterings.`
              : "Server summary storage is off."}
          </AppText>
          <Button
            loading={deleting}
            onPress={() => setDeleteVisible(true)}
            variant="danger"
          >
            Disconnect and delete summaries
          </Button>
          <AppText color="muted" variant="caption">
            This deletes Flutterings&apos;s imported summaries. Revoke Flutterings
            separately in the phone&apos;s Health settings to remove system permission.
          </AppText>
        </Card>
      ) : null}
      <SafetyCallout>
        Flutterings does not label health values as normal, abnormal, safe, or unsafe.
        Health data does not replace care from a qualified professional.
      </SafetyCallout>
      <Dialog
        actions={
          <>
            <Button
              loading={deleting}
              onPress={() => void disconnectAndDelete()}
              variant="danger"
            >
              Delete summaries
            </Button>
            <Button
              disabled={deleting}
              onPress={() => setDeleteVisible(false)}
              variant="ghost"
            >
              Cancel
            </Button>
          </>
        }
        onClose={() => {
          if (!deleting) setDeleteVisible(false);
        }}
        title="Disconnect and delete?"
        visible={deleteVisible}
      >
        <AppText>
          This deletes all health summaries stored in Flutterings and disconnects every
          linked health source. This action cannot be undone.
        </AppText>
      </Dialog>
    </Screen>
  );
}
