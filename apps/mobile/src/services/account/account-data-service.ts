import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { supabase } from "@/services/supabase/client";

type ExportResponse = { export?: Record<string, unknown> };

async function invoke(body: Record<string, unknown>): Promise<unknown> {
  const result = await supabase.functions.invoke("account-data", { body });
  if (result.error) throw result.error;
  return result.data;
}

export const accountDataService = {
  async deleteAccount(confirmation: string): Promise<void> {
    await invoke({ action: "deleteAccount", confirmation });
  },

  async exportAndShare(): Promise<"shared" | "unavailable"> {
    const data = (await invoke({ action: "export" })) as ExportResponse;
    if (!data.export || typeof data.export !== "object") {
      throw new Error("account_export_invalid");
    }
    if (!(await Sharing.isAvailableAsync())) return "unavailable";

    const date = new Date().toISOString().slice(0, 10);
    const file = new File(Paths.cache, `tender-account-export-${date}.json`);
    file.create({ overwrite: true });
    try {
      file.write(JSON.stringify(data.export, null, 2));
      await Sharing.shareAsync(file.uri, {
        dialogTitle: "Save Flutterings account export",
        mimeType: "application/json",
        UTI: "public.json",
      });
    } finally {
      if (file.exists) file.delete();
    }
    return "shared";
  },
};
