import { JourneyScreen } from "@/features/today-journey/journey-view";
import { useAuth } from "@/providers/auth-provider";

export default function JourneyRoute() {
  const { session } = useAuth();
  if (!session) return null;
  return <JourneyScreen ownerId={session.user.id} />;
}
