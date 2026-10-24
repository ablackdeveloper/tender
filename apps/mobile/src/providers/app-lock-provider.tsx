import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, StyleSheet, View } from "react-native";

import { AppText, Button, SafetyCallout } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import {
  appLockService,
  type AppLockAvailability,
} from "@/services/security/app-lock-service";
import { useTheme } from "@/theme/theme-provider";

type AppLockContextValue = {
  availability: AppLockAvailability | null;
  busy: boolean;
  disable: () => Promise<void>;
  enable: () => Promise<boolean>;
  enabled: boolean;
  error: boolean;
  initialized: boolean;
  unlock: () => Promise<void>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const { theme } = useTheme();
  const [availability, setAvailability] = useState<AppLockAvailability | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState("");
  const [locked, setLocked] = useState(false);
  const [obscured, setObscured] = useState(AppState.currentState !== "active");
  const authenticating = useRef(false);
  const userId = session?.user.id ?? "";
  const initialized = !userId || loadedUserId === userId;

  const authenticateAndUpdate = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    setBusy(true);
    setError(false);
    try {
      const success = await appLockService.authenticate();
      setLocked(!success);
      setObscured(!success);
      setError(!success);
    } catch {
      setLocked(true);
      setObscured(true);
      setError(true);
    } finally {
      authenticating.current = false;
      setBusy(false);
    }
  }, []);

  const unlock = useCallback(async () => {
    if (enabled) await authenticateAndUpdate();
  }, [authenticateAndUpdate, enabled]);

  useEffect(() => {
    let active = true;
    let unlockTimer: ReturnType<typeof setTimeout> | undefined;
    if (!userId) return;
    void Promise.all([appLockService.availability(), appLockService.isEnabled(userId)])
      .then(([nextAvailability, nextEnabled]) => {
        if (!active) return;
        setAvailability(nextAvailability);
        setEnabled(nextEnabled);
        setLocked(nextEnabled);
        setError(false);
        setLoadedUserId(userId);
        if (nextEnabled) {
          unlockTimer = setTimeout(() => void authenticateAndUpdate(), 0);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoadedUserId(userId);
        }
      });
    return () => {
      active = false;
      if (unlockTimer) clearTimeout(unlockTimer);
    };
  }, [authenticateAndUpdate, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        setObscured(true);
        if (enabled) setLocked(true);
      }
      if (enabled && nextState === "active") {
        setLocked(true);
        setTimeout(() => void authenticateAndUpdate(), 0);
      } else if (nextState === "active") {
        setObscured(false);
      }
    });
    return () => subscription.remove();
  }, [authenticateAndUpdate, enabled]);

  const enable = useCallback(async () => {
    if (!userId) return false;
    setBusy(true);
    setError(false);
    try {
      const nextAvailability = await appLockService.availability();
      setAvailability(nextAvailability);
      if (!nextAvailability.available) return false;
      const authenticated = await appLockService.authenticate();
      if (!authenticated) {
        setError(true);
        return false;
      }
      await appLockService.setEnabled(userId, true);
      setEnabled(true);
      setLocked(false);
      setObscured(false);
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const disable = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(false);
    try {
      await appLockService.setEnabled(userId, false);
      setEnabled(false);
      setLocked(false);
      setObscured(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const value = useMemo<AppLockContextValue>(
    () => ({
      availability,
      busy,
      disable,
      enable,
      enabled,
      error,
      initialized,
      unlock,
    }),
    [availability, busy, disable, enable, enabled, error, initialized, unlock],
  );
  const cover = Boolean(session && (!initialized || obscured || (enabled && locked)));

  return (
    <AppLockContext.Provider value={value}>
      <View
        importantForAccessibility={cover ? "no-hide-descendants" : "auto"}
        style={{ flex: 1 }}
      >
        {children}
      </View>
      {cover ? (
        <View
          accessibilityViewIsModal
          style={[
            StyleSheet.absoluteFill,
            {
              alignItems: "center",
              backgroundColor: theme.colors.background,
              gap: theme.spacing.lg,
              justifyContent: "center",
              padding: theme.spacing.xl,
              zIndex: 10_000,
            },
          ]}
        >
          <AppText accessibilityRole="header" variant="displayXL">
            Flutterings is locked
          </AppText>
          <AppText color="muted">
            Use your device lock to open your private records.
          </AppText>
          {initialized ? (
            <Button loading={busy} onPress={() => void unlock()}>
              Unlock Flutterings
            </Button>
          ) : null}
          {error ? (
            <SafetyCallout>
              Flutterings remains locked. Try again or use the device passcode option.
            </SafetyCallout>
          ) : null}
        </View>
      ) : null}
    </AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextValue {
  const value = useContext(AppLockContext);
  if (!value) throw new Error("useAppLock must be used inside AppLockProvider.");
  return value;
}
