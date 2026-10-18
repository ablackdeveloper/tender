import { useRouter } from "expo-router";

import { Screen } from "@/components/layout/screen";
import { AuthForm } from "@/features/auth/auth-form";

export default function SignInScreen() {
  const router = useRouter();
  return (
    <Screen>
      <AuthForm onRecovery={() => router.push("/auth/recover")} />
    </Screen>
  );
}
