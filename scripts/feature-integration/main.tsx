import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/theme/theme-provider";
import ProductLayout from "@/app/(app)/_layout";
import { ToastProvider } from "@/components/ui/toast";
import { AppScreen } from "./app-screens";
import { RouteContent } from "./router";
import { data } from "./app-data";
import { useDeviceNotice, clearDeviceNotice } from "./platform";
import "./fixtures";
import "./fonts.css";
import "./preview.css";
import { back, navigate, routeUrl, usePreviewLocation } from "./navigation";
import { useSaveStatus, savePreview, resetPreview } from "./persistence";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const links = [
  ["Plan", "/(app)/planning", "planning"],
  ["Journey", "/(app)/journey", "journey"],
  ["Care", "/(app)/care", "care"],
  ["Recovery", "/(app)/recovery", "recovery"],
  ["Memories", "/(app)/memories", "memories"],
] as const;
function PreviewApp() {
  const search = usePreviewLocation();
  const parameters = new URLSearchParams(search);
  const page = parameters.get("screen") ?? "planning";
  const notice = useDeviceNotice();
  const saveStatus = useSaveStatus();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [search]);
  return (
    <div className="preview-shell">
      <header className="preview-header">
        <div className="preview-heading">
          <button
            onClick={back}
            disabled={
              page === "planning" && (history.state?.previewIndex ?? 0) === 0
            }
          >
            ← Back
          </button>
          <strong>Flutterings preview</strong>
        </div>
        <p>
          Actual app screens · preview data. Records and automatic drafts stay
          in this browser after refresh. Sharing is simulated.
        </p>
        <p role="status" aria-label="Preview save status">
          {saveStatus === "saved"
            ? "Saved in this browser"
            : saveStatus === "ready"
              ? "Local saving is on"
              : saveStatus === "error"
                ? "Changes are not saved. Browser storage is blocked or full. Keep this tab open."
                : saveStatus === "conflict"
                  ? "Another tab changed the saved preview. This tab will not overwrite it."
                  : "Saved preview data could not be read. It has not been replaced."}
        </p>
        {saveStatus === "error" ? (
          <button onClick={savePreview}>Retry local save</button>
        ) : null}
        {saveStatus === "conflict" ? (
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Load the saved preview? Changes not saved in this tab will be lost.",
                )
              )
                location.reload();
            }}
          >
            Load saved preview
          </button>
        ) : null}
        <label className="preview-stage">
          Demo stage{" "}
          <select
            aria-label="Demo stage"
            value={
              data.pregnancy.lifecycleStatus === "birth" ? "birth" : "active"
            }
            onChange={async (event) => {
              const stage = event.target.value;
              data.pregnancy.lifecycleStatus = stage;
              data.pregnancy.postpartumMode = stage === "birth";
              data.pregnancy.compassionateMode = false;
              savePreview();
              await queryClient.invalidateQueries();
              navigate(stage === "birth" ? "/(app)/recovery" : "/(app)");
            }}
          >
            <option value="active">During pregnancy</option>
            <option value="birth">After birth</option>
          </select>
        </label>
        <details>
          <summary>Preview shortcuts and limits</summary>
          <p>
            Saved only in this browser profile at this address, not in your app
            account. Browser data is not encrypted by the preview. Clearing site
            data removes it. Use each screen’s Save button where provided.
          </p>
          <button onClick={resetPreview}>Reset saved preview</button>
          <p>
            Phone camera, recording, calendar, push notifications, exports, and
            account actions require the installed app. No invitations are sent.
            Review labels in sample reading are fixtures, not clinical approval.
          </p>
          <nav aria-label="Preview navigation">
            {links.map(([label, path, target]) => (
              <a
                key={target}
                href={routeUrl(path)}
                aria-current={
                  page === target || (target === "care" && page === "questions")
                    ? "page"
                    : undefined
                }
                onClick={(event) => {
                  if (
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey &&
                    event.button === 0
                  ) {
                    event.preventDefault();
                    navigate(path);
                  }
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </details>
        {notice ? (
          <div role="status" className="preview-notice">
            {notice}
            <button onClick={clearDeviceNotice}>Dismiss notice</button>
          </div>
        ) : null}
      </header>
      <main ref={main} tabIndex={-1} key={search}>
        {page === "onboarding" ? (
          <AppScreen screen={page} />
        ) : (
          <RouteContent.Provider value={<AppScreen screen={page} />}>
            <ProductLayout />
          </RouteContent.Provider>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider initialPreference="light" initialReduceMotionEnabled={true}>
      <ToastProvider>
        <PreviewApp />
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>,
);
