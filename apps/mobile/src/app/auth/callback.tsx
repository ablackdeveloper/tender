import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { Screen } from "@/components/layout/screen";
import { AppText, ErrorState, Skeleton } from "@/components/ui";
import { trackAnalytics } from "@/services/analytics/analytics";
import { createSessionFromUrl } from "@/services/auth/auth-callback";
import { useAuth } from "@/providers/auth-provider";

export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const router = useRouter();
  const { markRecoverySession } = useAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;
    let active = true;
    void createSessionFromUrl(url)
      .then(async () => {
        if (!active) return;
        const recovery = /(?:[?#&])(?:type|mode)=recovery(?:[&#]|$)/.test(url);
        if (recovery) await markRecoverySession();
        if (!active) return;
        trackAnalytics("auth_callback_completed", {
          method: url.includes("provider=") ? "oauth" : "email",
        });
        router.replace(recovery ? "/auth/update-password" : "/");
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [markRecoverySession, router, url]);

  return (
    <Screen contentContainerStyle={{ justifyContent: "center" }}>
      {error ? (
        <ErrorState
          actionLabel="Return to sign in"
          description="This link may be expired, incomplete, or already used. Request a new email."
          onAction={() => router.replace("/(auth)/sign-in")}
          title="We could not finish signing in"
        />
      ) : (
        <>
          <AppText accessibilityRole="header" variant="heading2">
            Finishing secure sign-in…
          </AppText>
          <Skeleton height={48} />
        </>
      )}
    </Screen>
  );
}
