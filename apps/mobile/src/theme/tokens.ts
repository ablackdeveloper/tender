import type { TextStyle, ViewStyle } from "react-native";

const shared = {
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
    display: 80,
  },
  radii: {
    compact: 12,
    default: 16,
    large: 20,
    full: 999,
  },
  sizes: {
    minimumTarget: 44,
    control: 48,
    icon: 20,
  },
  typography: {
    displayXL: {
      fontFamily: "Fraunces_300Light",
      fontSize: 40,
      lineHeight: 46,
    },
    displayL: {
      fontFamily: "Fraunces_400Regular",
      fontSize: 32,
      lineHeight: 38,
    },
    heading1: {
      fontFamily: "Fraunces_600SemiBold",
      fontSize: 24,
      lineHeight: 31,
    },
    heading2: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 20,
      lineHeight: 26,
    },
    heading3: {
      fontFamily: "DMSans_600SemiBold",
      fontSize: 16,
      lineHeight: 22,
    },
    bodyLarge: {
      fontFamily: "DMSans_400Regular",
      fontSize: 18,
      lineHeight: 29,
    },
    body: {
      fontFamily: "DMSans_400Regular",
      fontSize: 16,
      lineHeight: 26,
    },
    bodySmall: {
      fontFamily: "DMSans_400Regular",
      fontSize: 14,
      lineHeight: 21,
    },
    label: {
      fontFamily: "DMMono_500Medium",
      fontSize: 12,
      lineHeight: 17,
      letterSpacing: 0.4,
    },
    caption: {
      fontFamily: "DMMono_400Regular",
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0.2,
    },
  } satisfies Record<string, TextStyle>,
  elevation: {
    none: {} as ViewStyle,
    raised: {
      elevation: 1,
      shadowColor: "#1E1A16",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    } satisfies ViewStyle,
    overlay: {
      elevation: 4,
      shadowColor: "#1E1A16",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    } satisfies ViewStyle,
  },
} as const;

type SemanticColors = {
  [
    K in
      | "background"
      | "surface"
      | "surfaceMuted"
      | "text"
      | "textMuted"
      | "primary"
      | "onPrimary"
      | "secondary"
      | "onSecondary"
      | "accent"
      | "onAccent"
      | "border"
      | "focus"
      | "scrim"
      | "danger"
      | "onDanger"
      | "dangerSurface"
      | "success"
      | "successSurface"
      | "warning"
      | "warningSurface"
      | "skeleton"
  ]: string;
};

const lightColors: SemanticColors = {
  background: "#F9F6F0",
  surface: "#FFFDF8",
  surfaceMuted: "#EDE8DF",
  text: "#1E1A16",
  textMuted: "#5A5248",
  primary: "#8B4A5C",
  onPrimary: "#FFF8F9",
  secondary: "#5A6B5A",
  onSecondary: "#FFFEF9",
  accent: "#B8972A",
  onAccent: "#1E1A16",
  border: "#D6CFBF",
  focus: "#8B4A5C",
  scrim: "rgba(30, 26, 22, 0.48)",
  danger: "#A63D32",
  onDanger: "#FFFFFF",
  dangerSurface: "#FBEAE7",
  success: "#3F6F55",
  successSurface: "#E8F2EB",
  warning: "#806114",
  warningSurface: "#F7EFCF",
  skeleton: "#DED7CB",
};

const darkColors: typeof lightColors = {
  background: "#1A1714",
  surface: "#26211C",
  surfaceMuted: "#2E2920",
  text: "#F0EDE6",
  textMuted: "#9E9386",
  primary: "#C98DA0",
  onPrimary: "#1A0D12",
  secondary: "#8AA68A",
  onSecondary: "#0E160E",
  accent: "#D4AF45",
  onAccent: "#1A1200",
  border: "#3A3328",
  focus: "#C98DA0",
  scrim: "rgba(0, 0, 0, 0.68)",
  danger: "#F2A39A",
  onDanger: "#2A0C08",
  dangerSurface: "#47231F",
  success: "#9BC7AB",
  successSurface: "#20372A",
  warning: "#E3C467",
  warningSurface: "#3D3216",
  skeleton: "#3A3328",
};

export const themes = {
  light: { ...shared, colors: lightColors },
  dark: { ...shared, colors: darkColors },
} as const;

export type ThemeName = keyof typeof themes;
export type AppTheme = (typeof themes)[ThemeName];
export type TextVariant = keyof typeof shared.typography;
