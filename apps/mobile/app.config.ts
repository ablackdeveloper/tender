import type { ConfigContext, ExpoConfig } from "expo/config";

type AppEnvironment = "development" | "staging" | "production" | "e2e";

const variants: Record<
  AppEnvironment,
  { name: string; iosBundleIdentifier: string; androidPackage: string }
> = {
  e2e: {
    name: "Flutterings Isolated Tests",
    iosBundleIdentifier: "com.tender.companion.e2e",
    androidPackage: "com.tender.companion.e2e",
  },
  development: {
    name: "Flutterings Development",
    iosBundleIdentifier: "com.tender.companion.dev",
    androidPackage: "com.tender.companion.dev",
  },
  staging: {
    name: "Flutterings Staging",
    iosBundleIdentifier: "com.tender.companion.staging",
    androidPackage: "com.tender.companion.staging",
  },
  production: {
    name: "Flutterings",
    iosBundleIdentifier: "com.tender.companion",
    androidPackage: "com.tender.companion",
  },
};

function readAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === undefined) return "development";
  if (
    value === "development" ||
    value === "staging" ||
    value === "production" ||
    value === "e2e"
  ) {
    return value;
  }

  throw new Error(
    "TENDER_APP_ENV must be one of: development, staging, production, e2e.",
  );
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment = readAppEnvironment(process.env.TENDER_APP_ENV);
  const variant = variants[environment];

  return {
    ...config,
    name: variant.name,
    slug: "tender",
    owner: "ablackdeveloper",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/tender-app-icon-v1.png",
    scheme: "tender",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: variant.iosBundleIdentifier,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      supportsTablet: false,
      icon: "./assets/images/tender-app-icon-v1.png",
    },
    android: {
      package: variant.androidPackage,
      adaptiveIcon: {
        backgroundColor: "#F9F6F0",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: true,
    },
    web: {
      output: "single",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-asset",
      "expo-font",
      "expo-dev-client",
      "expo-web-browser",
      [
        "expo-notifications",
        {
          defaultChannel: "tender-reminders",
          enableBackgroundRemoteNotifications: false,
        },
      ],
      [
        "expo-calendar",
        {
          calendarPermission:
            "Allow Flutterings to add an appointment only when you choose calendar export.",
          writeOnlyAccess: true,
          writeOnlyCalendarPermission:
            "Allow Flutterings to add an appointment only when you choose calendar export.",
        },
      ],
      "expo-sharing",
      [
        "expo-image-picker",
        {
          cameraPermission:
            "Allow Flutterings to use your camera only when you choose to add a journal or meal photo.",
          microphonePermission: false,
          photosPermission:
            "Allow Flutterings to open your photo library only when you choose a journal or meal image.",
        },
      ],
      [
        "expo-audio",
        {
          enableBackgroundRecording: false,
          microphonePermission:
            "Allow Flutterings to use your microphone only while you record a journal voice note.",
        },
      ],
      [
        "expo-sqlite",
        {
          enableFTS: false,
          useSQLCipher: true,
        },
      ],
      [
        "expo-secure-store",
        {
          configureAndroidBackup: true,
          faceIDPermission:
            "Allow Flutterings to use Face ID when you choose to lock the app.",
        },
      ],
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "Allow Flutterings to use Face ID only when you enable the optional app lock.",
        },
      ],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#F9F6F0",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      ...config.extra,
      eas: {
        projectId: "f235721b-cc8f-45f3-89df-deb5d8183d01",
      },
    },
  };
};
