import * as Crypto from "expo-crypto";
import { type Href, Tabs, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui";
import { TabIcon } from "@/components/ui/tab-icon";
import { AddActionSheet, type AddAction } from "@/features/add/add-action-sheet";
import { useAuth } from "@/providers/auth-provider";
import {
  addActionPreferenceRepository,
  type AddActionKey,
} from "@/repositories/add-action-preference-repository";
import { useTheme } from "@/theme/theme-provider";

export default function ProductLayout() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [addVisible, setAddVisible] = useState(false);
  const [defaultAction, setDefaultAction] = useState<AddActionKey | null>(null);
  const [defaultError, setDefaultError] = useState(false);
  const longPressed = useRef(false);
  const ownerId = session?.user.id ?? "";

  const select = (action: () => void) => {
    setAddVisible(false);
    action();
  };

  const actions: AddAction[] = [
    {
      description: "Record how today feels without a score or streak.",
      key: "check_in",
      label: "Check-in",
      onPress: () => select(() => router.push("/(app)/check-in")),
    },
    {
      description: "Save a private note, photo, or voice memory.",
      key: "memory",
      label: "Memory",
      onPress: () => select(() => router.push("/(app)/journal/new")),
    },
    {
      description: "Record food without grades or calorie targets.",
      key: "meal",
      label: "Meal",
      onPress: () => select(() => router.push(`/(app)/meals/${Crypto.randomUUID()}`)),
    },
    {
      description: "Add one question to an upcoming appointment.",
      key: "appointment_question",
      label: "Appointment question",
      onPress: () => select(() => router.push("/(app)/appointment-question" as Href)),
    },
  ];
  const pinnedAction = actions.find((action) => action.key === defaultAction) ?? null;

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    void addActionPreferenceRepository
      .get(ownerId)
      .then((value) => {
        if (active) setDefaultAction(value);
      })
      .catch(() => {
        if (active) setDefaultError(true);
      });
    return () => {
      active = false;
    };
  }, [ownerId]);

  const changeDefault = async (action: AddActionKey | null) => {
    setDefaultError(false);
    try {
      await addActionPreferenceRepository.set(ownerId, action);
      setDefaultAction(action);
    } catch {
      setDefaultError(true);
    }
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarLabelStyle: theme.typography.label,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            minHeight: theme.sizes.minimumTarget + theme.spacing.md,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Today",
            tabBarButtonTestID: "tab-today",
            tabBarIcon: (props) => <TabIcon {...props} name="today" />,
          }}
        />
        <Tabs.Screen
          name="memories"
          options={{
            title: "Memories",
            tabBarButtonTestID: "tab-memories",
            tabBarIcon: (props) => <TabIcon {...props} name="memories" />,
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            tabBarButton: () => (
              <Pressable
                testID="tab-add"
                accessibilityLabel="Add"
                accessibilityRole="button"
                accessibilityHint={
                  pinnedAction
                    ? `Opens ${pinnedAction.label}. Press and hold to see all choices.`
                    : "Shows all capture choices."
                }
                delayLongPress={450}
                onLongPress={() => {
                  longPressed.current = true;
                  setAddVisible(true);
                }}
                onPress={() => {
                  if (longPressed.current) {
                    longPressed.current = false;
                    return;
                  }
                  if (pinnedAction) pinnedAction.onPress();
                  else setAddVisible(true);
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  flex: 1,
                  justifyContent: "center",
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.radii.full,
                    height: theme.sizes.control,
                    justifyContent: "center",
                    width: theme.sizes.control,
                    ...theme.elevation.raised,
                  }}
                >
                  <AppText
                    aria-hidden
                    style={{ color: theme.colors.onPrimary }}
                    variant="heading1"
                  >
                    +
                  </AppText>
                </View>
                <AppText color="muted" variant="caption">
                  Add
                </AppText>
              </Pressable>
            ),
            title: "Add",
          }}
        />
        <Tabs.Screen
          name="care"
          options={{
            title: "Care",
            tabBarButtonTestID: "tab-care",
            tabBarIcon: (props) => <TabIcon {...props} name="care" />,
          }}
        />
        <Tabs.Screen
          name="together"
          options={{
            title: "Together",
            tabBarButtonTestID: "tab-together",
            tabBarIcon: (props) => <TabIcon {...props} name="together" />,
          }}
        />
        <Tabs.Screen name="journey" options={{ href: null }} />
        <Tabs.Screen name="journal" options={{ href: null }} />
        <Tabs.Screen name="meals" options={{ href: null }} />
        <Tabs.Screen name="planning" options={{ href: null }} />
        <Tabs.Screen name="notification-settings" options={{ href: null }} />
        <Tabs.Screen name="pregnancy-settings" options={{ href: null }} />
        <Tabs.Screen name="privacy-data" options={{ href: null }} />
        <Tabs.Screen name="check-in" options={{ href: null }} />
        <Tabs.Screen name="appointment-question" options={{ href: null }} />
        <Tabs.Screen name="health-data" options={{ href: null }} />
        <Tabs.Screen name="memory-capsule" options={{ href: null }} />
        <Tabs.Screen name="recovery" options={{ href: null }} />
        <Tabs.Screen name="journal/[entryId]" options={{ href: null }} />
        <Tabs.Screen name="meals/[mealId]" options={{ href: null }} />
        <Tabs.Screen name="care/summary" options={{ href: null }} />
      </Tabs>
      <AddActionSheet
        actions={actions}
        defaultAction={defaultAction}
        defaultError={defaultError}
        onClose={() => setAddVisible(false)}
        onDefaultChange={changeDefault}
        visible={addVisible}
      />
    </>
  );
}
