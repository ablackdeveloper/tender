import {
  DMMono_400Regular,
  DMMono_500Medium,
  useFonts as useDMMonoFonts,
} from "@expo-google-fonts/dm-mono";
import {
  DMSans_400Regular,
  DMSans_600SemiBold,
  useFonts as useDMSansFonts,
} from "@expo-google-fonts/dm-sans";
import {
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_600SemiBold,
  useFonts as useFrauncesFonts,
} from "@expo-google-fonts/fraunces";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { getClientEnv } from "@/config/env";
import { Screen } from "@/components/layout/screen";
import { ErrorState } from "@/components/ui";
import { useSupabaseSessionLifecycle } from "@/hooks/use-supabase-session-lifecycle";
import { AppProviders } from "@/providers/app-providers";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/theme/theme-provider";

getClientEnv();
void SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { resolvedTheme, theme } = useTheme();
  const {
    initialized,
    onboardingComplete,
    onboardingError,
    refreshOnboarding,
    session,
  } = useAuth();
  useSupabaseSessionLifecycle();

  if (onboardingError) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <ErrorState
          actionLabel="Try again"
          description="Your session is safe, but Flutterings could not check setup status. Check your connection and retry."
          onAction={() => void refreshOnboarding().catch(() => undefined)}
          title="Setup status unavailable"
        />
      </Screen>
    );
  }

  // Keep the callback mounted while its new session loads setup status. The
  // entry route supplies the loading state; protected screens remain gated.
  if (!initialized) return null;

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="partner-invitation" />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session && onboardingComplete === false)}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="get-help" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session && onboardingComplete)}>
          <Stack.Screen name="(app)" />
          {__DEV__ ? (
            <Stack.Screen
              name="component-gallery"
              options={{ animation: "slide_from_bottom", presentation: "modal" }}
            />
          ) : null}
        </Stack.Protected>
      </Stack>
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  const [dmMonoLoaded, dmMonoError] = useDMMonoFonts({
    DMMono_400Regular,
    DMMono_500Medium,
  });
  const [dmSansLoaded, dmSansError] = useDMSansFonts({
    DMSans_400Regular,
    DMSans_600SemiBold,
  });
  const [frauncesLoaded, frauncesError] = useFrauncesFonts({
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_600SemiBold,
  });
  const ready = dmMonoLoaded && dmSansLoaded && frauncesLoaded;
  const failed = Boolean(dmMonoError || dmSansError || frauncesError);

  useEffect(() => {
    if (ready || failed) void SplashScreen.hideAsync();
  }, [failed, ready]);

  if (!ready && !failed) return null;

  return (
    <AppProviders>
      <Navigation />
    </AppProviders>
  );
}
