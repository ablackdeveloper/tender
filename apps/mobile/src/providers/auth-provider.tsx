import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { onboardingRepository } from "@/repositories/onboarding-repository";
import { signOutCurrentSession } from "@/services/auth/auth-service";
import { onboardingDraftStorage } from "@/services/onboarding/onboarding-draft-storage";
import { checkInDraftStorage } from "@/services/checkins/check-in-draft-storage";
import { questionDraftStorage } from "@/services/care/question-draft-storage";
import { clearJournalLocalData } from "@/services/journal/journal-local-cleanup";
import { clearMealLocalData } from "@/services/meals/meal-local-cleanup";
import { notificationService } from "@/services/notifications/notification-service";
import { appLockService } from "@/services/security/app-lock-service";
import { supabase } from "@/services/supabase/client";

type AuthContextValue = {
  initialized: boolean;
  completeAccountDeletion: () => Promise<void>;
  isRecovery: boolean;
  onboardingComplete: boolean | null;
  onboardingError: boolean;
  refreshOnboarding: () => Promise<void>;
  session: Session | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [initialized, setInitialized] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const refreshOnboarding = useCallback(async () => {
    if (!session) {
      setOnboardingComplete(null);
      setOnboardingError(false);
      return;
    }
    setOnboardingError(false);
    setOnboardingComplete(null);
    try {
      setOnboardingComplete(await onboardingRepository.isComplete());
    } catch (error) {
      setOnboardingError(true);
      throw error;
    }
  }, [session]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setSession(null);
        setOnboardingComplete(null);
      } else {
        setSession(data.session);
      }
      setInitialized(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setIsRecovery(event === "PASSWORD_RECOVERY");
      if (!nextSession) {
        queryClient.clear();
        setOnboardingComplete(null);
        setOnboardingError(false);
      }
      setInitialized(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void onboardingRepository
      .isComplete()
      .then((complete) => {
        if (active) {
          setOnboardingComplete(complete);
          setOnboardingError(false);
        }
      })
      .catch(() => {
        if (active) setOnboardingError(true);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const signOut = useCallback(async () => {
    const userId = session?.user.id;
    if (userId) await notificationService.unregisterForLogout().catch(() => undefined);
    if (userId)
      await Promise.all([clearJournalLocalData(userId), clearMealLocalData(userId)]);
    if (userId) await onboardingDraftStorage.clear(userId);
    if (userId) await checkInDraftStorage.clearUser(userId);
    if (userId) await questionDraftStorage.clearUser(userId);
    await signOutCurrentSession();
    setIsRecovery(false);
    setOnboardingComplete(null);
    setOnboardingError(false);
  }, [session]);

  const completeAccountDeletion = useCallback(async () => {
    const userId = session?.user.id;
    if (userId) {
      await Promise.all([
        clearJournalLocalData(userId),
        clearMealLocalData(userId),
        onboardingDraftStorage.clear(userId),
        checkInDraftStorage.clearUser(userId),
        questionDraftStorage.clearUser(userId),
        appLockService.clear(userId),
      ]);
    }
    await signOutCurrentSession().catch(() => undefined);
    setSession(null);
    setIsRecovery(false);
    setOnboardingComplete(null);
    setOnboardingError(false);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      completeAccountDeletion,
      isRecovery,
      onboardingComplete,
      onboardingError,
      refreshOnboarding,
      session,
      signOut,
    }),
    [
      initialized,
      completeAccountDeletion,
      isRecovery,
      onboardingComplete,
      onboardingError,
      refreshOnboarding,
      session,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
