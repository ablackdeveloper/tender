import { Children, createContext, useContext } from "react";
import { View, Pressable } from "react-native-web";
import { AppText } from "@/components/ui/app-text";
import {
  back,
  navigate,
  usePreviewLocation,
  useLocalSearchParams,
} from "./navigation";
import { state } from "./fixtures";
export { useLocalSearchParams };
export const RouteContent = createContext<any>(null);
export const useRouter = () => ({
  push: (route: any) => {
    state.routes.push(route);
    navigate(route);
  },
  replace: (route: any) => {
    state.routes.push(route);
    navigate(route, true);
  },
  back,
});
export function usePathname() {
  const params = new URLSearchParams(usePreviewLocation());
  return params.get("screen") === "help"
    ? "/get-help"
    : `/${params.get("screen") ?? "planning"}`;
}
function WebTabs({ children, screenOptions }: any) {
  const content = useContext(RouteContent);
  const current =
    new URLSearchParams(usePreviewLocation()).get("screen") ?? "planning";
  const destinations: any = {
    index: "today",
    memories: "memories",
    care: "care",
    together: "together",
  };
  return (
    <>
      <View style={{ flex: 1, minHeight: 0 }}>{content}</View>
      <View
        accessibilityRole="tablist"
        style={[
          screenOptions.tabBarStyle,
          { flexDirection: "row", flexShrink: 0 },
        ]}
      >
        {Children.toArray(children)
          .filter((child: any) => child.props.options?.href !== null)
          .map((child: any) => {
            const { name, options } = child.props;
            if (options?.tabBarButton)
              return (
                <View key={name} style={{ flex: 1 }}>
                  {options.tabBarButton()}
                </View>
              );
            const selected =
              current === destinations[name] ||
              (name === "memories" &&
                ["reflection", "capsule", "meal"].includes(current)) ||
              (name === "care" && ["questions", "summary"].includes(current));
            return (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={options.title}
                onPress={() =>
                  navigate(name === "index" ? "/(app)" : `/(app)/${name}`)
                }
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 64,
                }}
              >
                <AppText
                  style={{
                    color: selected
                      ? screenOptions.tabBarActiveTintColor
                      : screenOptions.tabBarInactiveTintColor,
                  }}
                  variant="caption"
                >
                  {options.title}
                </AppText>
              </Pressable>
            );
          })}
      </View>
    </>
  );
}
export const Tabs = Object.assign(WebTabs, { Screen: (_props: any) => null });
