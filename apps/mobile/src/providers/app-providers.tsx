import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/theme/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { AppLockProvider } from "@/providers/app-lock-provider";
import { NetworkProvider } from "@/providers/network-provider";
import { JournalUploadResume } from "@/providers/journal-upload-resume";
import { MealSyncResume } from "@/providers/meal-sync-resume";
import { NotificationProvider } from "@/providers/notification-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <NetworkProvider>
            <AuthProvider>
              <AppLockProvider>
                <NotificationProvider />
                <JournalUploadResume />
                <MealSyncResume />
                <ToastProvider>{children}</ToastProvider>
              </AppLockProvider>
            </AuthProvider>
          </NetworkProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
