import { Platform } from "react-native";

export const supportedHealthMetrics = [
  "sleep_duration_minutes",
  "steps",
  "workout_duration_minutes",
  "mindfulness_duration_minutes",
] as const;

export type HealthMetricType = (typeof supportedHealthMetrics)[number];
export type HealthAvailability =
  | { available: false; reason: "native_adapter_required" | "unsupported_platform" }
  | { available: true; platform: "apple_health" | "health_connect" };

export interface HealthDataRepository {
  availability(): Promise<HealthAvailability>;
  readDailySummaries(input: {
    endDate: string;
    metrics: HealthMetricType[];
    startDate: string;
  }): Promise<never[]>;
  requestReadAccess(metrics: HealthMetricType[]): Promise<void>;
}

class NativeAdapterBoundary implements HealthDataRepository {
  async availability(): Promise<HealthAvailability> {
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      return { available: false, reason: "unsupported_platform" };
    }
    return { available: false, reason: "native_adapter_required" };
  }

  async readDailySummaries(): Promise<never[]> {
    throw new Error("native_health_adapter_required");
  }

  async requestReadAccess(): Promise<void> {
    throw new Error("native_health_adapter_required");
  }
}

export const healthDataRepository: HealthDataRepository = new NativeAdapterBoundary();
