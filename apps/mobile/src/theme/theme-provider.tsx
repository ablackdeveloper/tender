import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";

import { themes, type AppTheme, type ThemeName } from "@/theme/tokens";

export type ThemePreference = ThemeName | "system";

type ThemeContextValue = {
  preference: ThemePreference;
  reduceMotionEnabled: boolean;
  resolvedTheme: ThemeName;
  setPreference: (preference: ThemePreference) => void;
  theme: AppTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = PropsWithChildren<{
  initialReduceMotionEnabled?: boolean;
  initialPreference?: ThemePreference;
}>;

export function ThemeProvider({
  children,
  initialPreference = "system",
  initialReduceMotionEnabled,
}: ThemeProviderProps) {
  const systemTheme = useColorScheme();
  const [preference, setPreference] = useState(initialPreference);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(
    initialReduceMotionEnabled ?? false,
  );

  useEffect(() => {
    if (initialReduceMotionEnabled !== undefined) return;
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionEnabled,
    );

    return () => subscription.remove();
  }, [initialReduceMotionEnabled]);

  const resolvedTheme: ThemeName =
    preference === "system" ? (systemTheme === "dark" ? "dark" : "light") : preference;
  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      reduceMotionEnabled,
      resolvedTheme,
      setPreference,
      theme: themes[resolvedTheme],
    }),
    [preference, reduceMotionEnabled, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }
  return value;
}
