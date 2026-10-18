import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/app-text";
import { useTheme } from "@/theme/theme-provider";

type ToastTone = "default" | "success" | "danger";
type ToastInput = { duration?: number; message: string; tone?: ToastTone };
type ToastContextValue = { dismiss: () => void; show: (input: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastInput | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((input: ToastInput) => {
    setToast(input);
    AccessibilityInfo.announceForAccessibility(input.message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(dismiss, toast.duration ?? 4000);
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [dismiss, toast]);

  const backgroundColor =
    toast?.tone === "danger"
      ? theme.colors.dangerSurface
      : toast?.tone === "success"
        ? theme.colors.successSurface
        : theme.colors.surface;
  const color =
    toast?.tone === "danger"
      ? "danger"
      : toast?.tone === "success"
        ? "success"
        : "default";

  return (
    <ToastContext.Provider value={{ dismiss, show }}>
      {children}
      {toast ? (
        <View
          accessibilityLabel={toast.message}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={{
            backgroundColor,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.default,
            borderWidth: 1,
            left: theme.spacing.lg,
            padding: theme.spacing.md,
            position: "absolute",
            right: theme.spacing.lg,
            top: insets.top + theme.spacing.sm,
            ...theme.elevation.overlay,
          }}
        >
          <AppText color={color} variant="bodySmall">
            {toast.message}
          </AppText>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider.");
  return value;
}
