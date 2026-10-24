import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Switch, View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Dialog,
  ErrorState,
  Field,
  PrivacyBadge,
  SafetyCallout,
} from "@/components/ui";
import { getClientEnv } from "@/config/env";
import { useAppLock } from "@/providers/app-lock-provider";
import { useAuth } from "@/providers/auth-provider";
import { accountDataService } from "@/services/account/account-data-service";
import { useTheme } from "@/theme/theme-provider";

export function PrivacyDataScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { completeAccountDeletion, session, signOut } = useAuth();
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const appLock = useAppLock();
  const [confirmation, setConfirmation] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [externalPageError, setExternalPageError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const clientEnv = getClientEnv();
  const healthEnabled = clientEnv.EXPO_PUBLIC_HEALTH_DATA_ENABLED;

  async function changeAppLock(nextEnabled: boolean) {
    setMessage(null);
    if (nextEnabled) {
      const enabled = await appLock.enable();
      setMessage(
        enabled
          ? "App lock is on for this device."
          : "App lock remains off. Configure a device passcode or biometric lock, then try again.",
      );
    } else {
      await appLock.disable();
      setMessage("App lock is off for this device.");
    }
  }

  async function exportData() {
    setExportBusy(true);
    setExportError(false);
    setMessage(null);
    try {
      const result = await accountDataService.exportAndShare();
      setMessage(
        result === "shared"
          ? "Your account export was prepared in the system share sheet."
          : "File sharing is not available on this device.",
      );
    } catch {
      setExportError(true);
    } finally {
      setExportBusy(false);
    }
  }

  async function openExternalPage(url: string, label: string) {
    setExternalPageError(false);
    try {
      await Linking.openURL(url);
    } catch {
      setExternalPageError(true);
      setMessage(`${label} did not open.`);
    }
  }

  async function deleteAccount() {
    if (confirmation !== "DELETE") return;
    setDeleteBusy(true);
    setDeleteError(false);
    try {
      await accountDataService.deleteAccount(confirmation);
      await completeAccountDeletion();
    } catch {
      setDeleteError(true);
      setDeleteBusy(false);
    }
  }

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="heading1">
        Privacy and data
      </AppText>
      <PrivacyBadge level="private" />
      <Button
        variant="secondary"
        onPress={() => {
          setSignOutError(false);
          setSignOutVisible(true);
        }}
      >
        Sign out
      </Button>
      <Dialog
        title="Sign out of Flutterings?"
        visible={signOutVisible}
        onClose={() => {
          if (!signOutBusy) setSignOutVisible(false);
        }}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={signOutBusy}
              onPress={() => setSignOutVisible(false)}
            >
              Stay signed in
            </Button>
            <Button
              loading={signOutBusy}
              onPress={() => {
                setSignOutBusy(true);
                setSignOutError(false);
                void signOut()
                  .then(() => setSignOutVisible(false))
                  .catch(() => setSignOutError(true))
                  .finally(() => setSignOutBusy(false));
              }}
            >
              Confirm sign out
            </Button>
          </>
        }
      >
        <AppText>
          Saved account records remain in your account. Drafts and files that are only
          on this device will be removed. Save your work before you sign out.
        </AppText>
        {signOutError ? (
          <ErrorState
            title="Sign out did not finish"
            description="Keep this screen open and try again."
          />
        ) : null}
      </Dialog>
      <AppText color="muted">
        Review device protection, sharing, exports, and permanent deletion in one place.
      </AppText>

      {message ? (
        <AppText accessibilityLiveRegion="polite" color="success">
          {message}
        </AppText>
      ) : null}
      {exportError ? (
        <ErrorState
          description="No account data was changed. Check your connection and try again."
          title="Export unavailable"
        />
      ) : null}
      {externalPageError ? (
        <ErrorState
          description="No account data was changed. Check your connection and try again."
          title="Page unavailable"
        />
      ) : null}

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">App lock</AppText>
        <AppText color="muted">
          Use the passcode, fingerprint, or face protection configured on this device.
          Flutterings does not receive biometric data.
        </AppText>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: theme.spacing.md,
            justifyContent: "space-between",
            minHeight: theme.sizes.minimumTarget,
          }}
        >
          <AppText style={{ flex: 1 }} variant="heading3">
            Lock Flutterings when it leaves the screen
          </AppText>
          <Switch
            accessibilityLabel="App lock"
            accessibilityRole="switch"
            accessibilityState={{ checked: appLock.enabled }}
            disabled={appLock.busy || !appLock.initialized}
            onValueChange={(value) => void changeAppLock(value)}
            value={appLock.enabled}
          />
        </View>
        {appLock.availability && !appLock.availability.available ? (
          <SafetyCallout>
            {appLock.availability.reason === "unsupported_platform"
              ? "App lock is available only in the iOS and Android app."
              : "Set a device passcode or biometric lock before enabling Flutterings app lock."}
          </SafetyCallout>
        ) : null}
      </Card>

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Sharing access</AppText>
        <AppText color="muted">
          Review invited people, active access, item exceptions, and access history.
        </AppText>
        <Button onPress={() => router.push("/(app)/together")} variant="secondary">
          Review partner access
        </Button>
        <Button
          onPress={() => router.push("/(app)/notification-settings")}
          variant="ghost"
        >
          Notification privacy
        </Button>
        {healthEnabled ? (
          <Button
            onPress={() => router.push("/(app)/health-data" as Href)}
            variant="ghost"
          >
            Stored health summaries
          </Button>
        ) : null}
      </Card>

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Export account records</AppText>
        <AppText color="muted">
          Create a JSON file with your profile, settings, written records, health
          summaries, and media-file inventory. Photo, audio, and document files are not
          copied into this export.
        </AppText>
        <Button loading={exportBusy} onPress={() => void exportData()}>
          Create and share export
        </Button>
      </Card>

      {clientEnv.EXPO_PUBLIC_PRIVACY_POLICY_URL || clientEnv.EXPO_PUBLIC_SUPPORT_URL ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading2">Policies and support</AppText>
          <AppText color="muted">
            Review how Flutterings handles data or open the public support page.
          </AppText>
          {clientEnv.EXPO_PUBLIC_PRIVACY_POLICY_URL ? (
            <Button
              onPress={() =>
                void openExternalPage(
                  clientEnv.EXPO_PUBLIC_PRIVACY_POLICY_URL!,
                  "Privacy policy",
                )
              }
              variant="secondary"
            >
              Privacy policy
            </Button>
          ) : null}
          {clientEnv.EXPO_PUBLIC_SUPPORT_URL ? (
            <Button
              onPress={() =>
                void openExternalPage(
                  clientEnv.EXPO_PUBLIC_SUPPORT_URL!,
                  "Support page",
                )
              }
              variant="ghost"
            >
              Support
            </Button>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText color="danger" variant="heading2">
          Delete account
        </AppText>
        <AppText color="muted">
          This permanently deletes your Flutterings account, pregnancy records, stored
          media, health summaries, invitations, and sharing access. This cannot be
          undone.
        </AppText>
        <Button onPress={() => setDeleteVisible(true)} variant="danger">
          Delete my account
        </Button>
      </Card>

      <SafetyCallout>
        Flutterings keeps health records private by default. Exporting or sharing a file
        moves it outside Flutterings and may expose it to another app or person.
      </SafetyCallout>

      <Dialog
        actions={
          <>
            <Button
              disabled={confirmation !== "DELETE"}
              loading={deleteBusy}
              onPress={() => void deleteAccount()}
              variant="danger"
            >
              Permanently delete account
            </Button>
            <Button
              disabled={deleteBusy}
              onPress={() => {
                setConfirmation("");
                setDeleteError(false);
                setDeleteVisible(false);
              }}
              variant="ghost"
            >
              Cancel
            </Button>
          </>
        }
        onClose={() => {
          if (!deleteBusy) setDeleteVisible(false);
        }}
        title="Delete Flutterings account?"
        visible={deleteVisible}
      >
        <AppText>
          Type DELETE to confirm permanent deletion for{" "}
          {session?.user.email ?? "this account"}.
        </AppText>
        <Field
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!deleteBusy}
          error={
            deleteError
              ? "Deletion did not finish. Your signed-in session remains so you can retry."
              : undefined
          }
          label="Confirmation"
          onChangeText={setConfirmation}
          placeholder="DELETE"
          value={confirmation}
        />
      </Dialog>
    </Screen>
  );
}
