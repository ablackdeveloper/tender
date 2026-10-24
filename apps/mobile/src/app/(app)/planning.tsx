import { Screen } from "@/components/layout/screen";
import { ErrorState, Skeleton } from "@/components/ui";
import { PlanningScreen } from "@/features/planning/planning-screen";
import { useTogetherContext } from "@/features/together/queries";
import { useAuth } from "@/providers/auth-provider";
import { useLocalSearchParams } from "expo-router";

export default function PlanningRoute() {
  const { template } = useLocalSearchParams<{ template?: string }>();
  const { session } = useAuth();
  const ownerId = session?.user.id ?? "";
  const context = useTogetherContext(ownerId);
  if (context.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading planning context" height={180} />
      </Screen>
    );
  if (!context.data?.pregnancyId)
    return (
      <Screen>
        <ErrorState
          title="Planning unavailable"
          description="Complete pregnancy setup or retry when connected."
        />
      </Screen>
    );
  const data = context.data;
  if (!data.isOwner)
    return (
      <Screen>
        <ErrorState
          title="Owner-managed plans"
          description="Shared tasks and support requests remain available in Together. Only the owner can create or change them."
        />
      </Screen>
    );
  return (
    <PlanningScreen
      initialTemplateId={typeof template === "string" ? template : undefined}
      ownerId={ownerId}
      pregnancyId={data.pregnancyId}
      requestedFromUserId={
        data.members.find(
          (member) =>
            member.userId !== data.ownerId &&
            member.status === "active" &&
            data.grants.some(
              (grant) =>
                grant.granteeUserId === member.userId &&
                grant.permission === "support_requests.read",
            ),
        )?.userId ?? null
      }
    />
  );
}
