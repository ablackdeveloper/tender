import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};
const allowedBuckets = new Set(["tender-documents", "tender-media"]);

function reply(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { ...cors, "Cache-Control": "no-store" },
  });
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

type StorageObjectRow = { storage_bucket: string; storage_path: string };

async function listOwnedObjects(
  service: SupabaseClient,
  table: "documents" | "media_assets",
  ownerId: string,
): Promise<{ data: StorageObjectRow[]; error: boolean }> {
  const data: StorageObjectRow[] = [];
  const pageSize = 1_000;
  for (let start = 0; ; start += pageSize) {
    const page = await service
      .from(table)
      .select("storage_bucket,storage_path")
      .eq("owner_id", ownerId)
      .range(start, start + pageSize - 1);
    if (page.error) return { data, error: true };
    data.push(...((page.data ?? []) as StorageObjectRow[]));
    if ((page.data?.length ?? 0) < pageSize) return { data, error: false };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return reply(500, { error: "server_configuration_missing" });
  }

  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const jwt = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/iu, "");
  const auth = await service.auth.getUser(jwt);
  const user = auth.data.user;
  if (auth.error || !user) return reply(401, { error: "unauthorized" });

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return reply(400, { error: "invalid_request" });
  }

  if (body.action === "export") {
    const result = await service.rpc("build_account_export", { p_actor_id: user.id });
    if (result.error) return reply(500, { error: "export_failed" });
    const payload = {
      account: {
        created_at: user.created_at,
        email: user.email ?? null,
        phone: user.phone ?? null,
        providers: user.app_metadata?.providers ?? [],
      },
      ...((result.data ?? {}) as Record<string, unknown>),
    };
    const size = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
    if (size > 8_000_000) return reply(413, { error: "export_too_large" });

    await service.from("access_audit_events").insert({
      actor_user_id: user.id,
      event_type: "account.exported",
      metadata: { format_version: 1 },
      request_id: crypto.randomUUID(),
      resource_id: user.id,
      resource_type: "account",
      subject_user_id: user.id,
    });
    return reply(200, { export: payload });
  }

  if (body.action === "deleteAccount") {
    if (body.confirmation !== "DELETE") {
      return reply(400, { error: "confirmation_required" });
    }

    const now = new Date().toISOString();
    const job = await service
      .from("deletion_jobs")
      .insert({
        deletion_scope: "account",
        owner_id: user.id,
        requested_at: now,
        scheduled_for: now,
        started_at: now,
        status: "processing",
      })
      .select("id")
      .single();
    if (job.error || !job.data) return reply(500, { error: "deletion_failed" });

    const [media, documents] = await Promise.all([
      listOwnedObjects(service, "media_assets", user.id),
      listOwnedObjects(service, "documents", user.id),
    ]);
    if (media.error || documents.error) {
      await service
        .from("deletion_jobs")
        .update({ failure_code: "storage_inventory_failed", status: "failed" })
        .eq("id", job.data.id);
      return reply(500, { error: "deletion_failed" });
    }

    const objects = new Map<string, string[]>();
    for (const item of [...media.data, ...documents.data]) {
      if (!allowedBuckets.has(item.storage_bucket)) continue;
      objects.set(item.storage_bucket, [
        ...(objects.get(item.storage_bucket) ?? []),
        item.storage_path,
      ]);
    }
    for (const [bucket, paths] of objects) {
      for (const batch of chunks([...new Set(paths)], 100)) {
        const removal = await service.storage.from(bucket).remove(batch);
        if (removal.error) {
          await service
            .from("deletion_jobs")
            .update({ failure_code: "storage_delete_failed", status: "failed" })
            .eq("id", job.data.id);
          return reply(500, { error: "deletion_failed" });
        }
      }
    }

    const deletion = await service.auth.admin.deleteUser(user.id, false);
    if (deletion.error) {
      await service
        .from("deletion_jobs")
        .update({ failure_code: "auth_delete_failed", status: "failed" })
        .eq("id", job.data.id);
      return reply(500, { error: "deletion_failed" });
    }
    return reply(200, { status: "deleted" });
  }

  return reply(400, { error: "invalid_request" });
});
