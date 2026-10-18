import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { providerSummaryHtml } from "@/features/care/provider-summary";

export async function printProviderSummary(summary: string): Promise<void> {
  await Print.printAsync({ html: providerSummaryHtml(summary) });
}

export async function shareProviderSummary(
  summary: string,
): Promise<"shared" | "unavailable"> {
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  const file = await Print.printToFileAsync({ html: providerSummaryHtml(summary) });
  await Sharing.shareAsync(file.uri, {
    dialogTitle: "Share user-reported provider summary",
    mimeType: "application/pdf",
    UTI: ".pdf",
  });
  return "shared";
}
