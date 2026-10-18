import { useSyncExternalStore } from "react";
type Route = string | { pathname: string; params?: Record<string, string> };
const destinations: Record<string, string> = {
  "/(app)": "today",
  "/(app)/index": "today",
  "/(app)/care/summary": "summary",
  "/(app)/notification-settings": "notifications",
  "/(app)/privacy-data": "privacy",
  "/(app)/health-data": "health",
  "/(app)/check-in": "checkin",
  "/(app)/meals": "meals",
  "/(app)/meals/[mealId]": "meal",
  "/(app)/memory-capsule": "capsule",
  "/get-help": "help",
  "/(app)/planning": "planning",
  "/(app)/journey": "journey",
  "/(app)/care": "care",
  "/(app)/appointment-question": "questions",
  "/(app)/recovery": "recovery",
  "/(app)/together": "together",
  "/(app)/journal/[entryId]": "reflection",
  "/(app)/memories": "memories",
  "/(app)/pregnancy-settings": "settings",
};
const eventName = "flutterings-preview-navigation";
if (!Number.isInteger(history.state?.previewIndex))
  history.replaceState({ previewIndex: 0 }, "", location.href);
export function routeUrl(route: Route) {
  const path = typeof route === "string" ? route : route.pathname;
  const query = new URLSearchParams({
    screen: destinations[path] ?? "unavailable",
  });
  if (path.startsWith("/(app)/journal/") && !path.includes("[")) {
    query.set("screen", "reflection");
    query.set("entryId", path.split("/").at(-1)!);
  }
  if (path.startsWith("/(app)/meals/") && !path.includes("[")) {
    query.set("screen", "meal");
    query.set("mealId", path.split("/").at(-1)!);
  }
  if (typeof route !== "string")
    for (const [key, value] of Object.entries(route.params ?? {}))
      query.set(key, value);
  return `/?${query}`;
}
export function navigate(route: Route, replace = false) {
  const index = history.state?.previewIndex ?? 0;
  history[replace ? "replaceState" : "pushState"](
    { previewIndex: index + (replace ? 0 : 1) },
    "",
    routeUrl(route),
  );
  window.dispatchEvent(new Event(eventName));
}
export function back() {
  if ((history.state?.previewIndex ?? 0) > 0) history.back();
  else navigate("/(app)/planning", true);
}
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(eventName, listener);
  };
}
export function usePreviewLocation() {
  return useSyncExternalStore(subscribe, () => location.search);
}
export function useLocalSearchParams() {
  return Object.fromEntries(new URLSearchParams(usePreviewLocation()));
}
