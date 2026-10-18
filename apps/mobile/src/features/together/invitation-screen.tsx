import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { Screen } from "@/components/layout/screen";
import { AppText, Button, ErrorState, Field, SafetyCallout } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { partnerSharingService } from "@/services/sharing/partner-sharing-service";

export function InvitationScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [token, setToken] = useState(params.token ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function respond(action: "accept" | "decline") {
    setBusy(true);
    setError(false);
    try {
      await partnerSharingService[action](token);
      router.replace("/");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <AppText accessibilityRole="header" variant="heading1">
        Partner invitation
      </AppText>
      <SafetyCallout>
        Accepting creates membership and only the invitation’s named read categories. It
        does not permit edits or expose private journal entries.
      </SafetyCallout>
      <Field
        autoCapitalize="none"
        label="Invitation token"
        onChangeText={setToken}
        secureTextEntry
        value={token}
      />
      {!session ? (
        <Button onPress={() => router.push("/(auth)/sign-in")}>
          Sign in to respond
        </Button>
      ) : null}
      {error ? (
        <ErrorState
          title="Invitation could not be processed"
          description="The token may be invalid, expired, already used, declined, revoked, or for a different signed-in email."
        />
      ) : null}
      <Button
        disabled={!session || busy || token.length < 43}
        onPress={() => void respond("accept")}
      >
        Accept invitation
      </Button>
      <Button
        disabled={!session || busy || token.length < 43}
        onPress={() => void respond("decline")}
        variant="secondary"
      >
        Decline invitation
      </Button>
    </Screen>
  );
}
