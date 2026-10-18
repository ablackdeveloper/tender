import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/providers/auth-provider";
import {
  configureForegroundNotifications,
  notificationService,
} from "@/services/notifications/notification-service";

configureForegroundNotifications();

export function NotificationProvider() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!session || Platform.OS === "web") return;
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      void notificationService.rotateToken(token.data).catch(() => undefined);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const jobId = response.notification.request.content.data?.notificationJobId;
        if (typeof jobId !== "string") return;
        void notificationService
          .resolveDestination(jobId)
          .then((route) => router.push(route as never))
          .catch(() => undefined);
      },
    );
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const jobId = response?.notification.request.content.data?.notificationJobId;
      if (typeof jobId !== "string") return;
      void notificationService
        .resolveDestination(jobId)
        .then((route) => router.push(route as never))
        .catch(() => undefined);
    });
    return () => {
      tokenSubscription.remove();
      responseSubscription.remove();
    };
  }, [router, session]);

  return null;
}
