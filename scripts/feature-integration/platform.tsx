import { forwardRef, useMemo, useSyncExternalStore } from "react";
import { View } from "react-native-web";
import { flags } from "./fixtures";
import { ownerId } from "./app-data";
import { navigate } from "./navigation";
let message = "";
export function deviceNotice(action: string) {
  message = `${action} requires the installed app. Nothing was sent, uploaded, or changed on your device.`;
  window.dispatchEvent(new Event("preview-device"));
}
export function useDeviceNotice() {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener("preview-device", listener);
      return () => window.removeEventListener("preview-device", listener);
    },
    () => message,
  );
}
export function clearDeviceNotice() {
  message = "";
  window.dispatchEvent(new Event("preview-device"));
}
export const SafeAreaView = forwardRef<any, any>((props, ref) => (
  <View {...props} ref={ref} />
));
export const SafeAreaProvider = ({ children }: any) => children;
export const useSafeAreaInsets = () => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
});
export const useAuth = () => ({
  session: { user: { id: ownerId } },
  completeAccountDeletion: async () => deviceNotice("Account deletion"),
  signOut: async () => deviceNotice("Signing out of an account"),
  refreshOnboarding: async () => navigate("/(app)", true),
});
export const useOptionalAuth = useAuth;
export const useNetworkStatus = () => ({ isOnline: !flags.has("offline") });
export const useAppLock = () => ({
  enabled: false,
  busy: false,
  initialized: true,
  availability: { available: false, reason: "unsupported_platform" },
  isEnabled: false,
  supported: false,
  enable: async () => {
    deviceNotice("App lock");
    return false;
  },
  disable: async () => {},
});
export const getClientEnv = () => ({
  EXPO_PUBLIC_REVIEWED_CONTENT_ENABLED: true,
  EXPO_PUBLIC_HEALTH_DATA_ENABLED: false,
  EXPO_PUBLIC_VOICE_TRANSCRIPTION_ENABLED: false,
  EXPO_PUBLIC_AUTH_APPLE_ENABLED: false,
  EXPO_PUBLIC_AUTH_GOOGLE_ENABLED: false,
  EXPO_PUBLIC_PRIVACY_POLICY_URL: "",
  EXPO_PUBLIC_SUPPORT_URL: "",
});
const unsupported = async () => {
  deviceNotice("This device action");
  throw new Error("device_action_unavailable_in_preview");
};
export const journalMediaService = {
  prepareImage: unsupported,
  stageVoice: unsupported,
  upload: unsupported,
  isActive: () => false,
  cancel: async () => {},
  deleteLocal: () => {},
};
export const documentService = { pick: unsupported, upload: unsupported };
export const exportAppointmentToCalendar = async () => {
  deviceNotice("Calendar export");
  return "unavailable";
};
export const printProviderSummary = unsupported;
export const shareProviderSummary = async () => {
  deviceNotice("System sharing");
  return "unavailable";
};
export const notificationService = {
  registerAfterUserAction: async () => {
    deviceNotice("Push notifications");
    return { status: "unsupported" };
  },
};
export const accountDataService = {
  exportAndShare: async () => {
    deviceNotice("Account export");
    return "unavailable";
  },
  deleteAccount: unsupported,
};
export const healthDataRepository = {
  availability: async () => ({
    available: false,
    reason: "unsupported_platform",
  }),
};
export const RecordingPresets = { HIGH_QUALITY: {} };
export const useAudioRecorder = () =>
  useMemo(
    () => ({
      uri: null,
      prepareToRecordAsync: unsupported,
      record() {},
      stop: async () => {},
    }),
    [],
  );
export const useAudioRecorderState = () => ({
  isRecording: false,
  durationMillis: 0,
});
export const useAudioPlayer = () => ({ play() {}, pause() {} });
export const requestRecordingPermissionsAsync = async () => {
  deviceNotice("Microphone recording");
  return { granted: false };
};
export const setAudioModeAsync = async () => {};
export const randomUUID = () => crypto.randomUUID();
