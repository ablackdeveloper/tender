import { NotificationSettingsScreen } from "@/features/notifications/notification-settings-screen";
import { useAuth } from "@/providers/auth-provider";

export default function NotificationSettingsRoute() {
  const { session } = useAuth();
  return <NotificationSettingsScreen ownerId={session?.user.id ?? ""} />;
}
