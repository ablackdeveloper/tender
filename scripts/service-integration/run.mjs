import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServiceHarness } from "./harness.mjs";
import { productionAuth } from "./production-auth.mjs";

export async function runServiceFlows(h) {
  const auth = (c) => productionAuth(c, `${h.apiUrl}/callback`);
  const requestEmail = async (user) => {
    const after = h.mail.messages.length;
    await auth(user.client).requestEmailAuthentication(user.email);
    return h.mail.read(user.email, after);
  };
  const login = async (user) => {
    const mail = await requestEmail(user);
    await auth(user.client).verifyEmailOtp(user.email, mail.otp);
    assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
    return mail;
  };
  const session = async (c) => (await c.auth.getSession()).data.session;
  const follow = async (link) => {
    assert.equal(new URL(link).origin, h.apiUrl);
    const response = await fetch(link, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 303);
    const location = response.headers.get("location");
    assert.equal(new URL(location).origin, h.apiUrl);
    return location;
  };
  const onboard = async (user) => {
    const pregnancy = randomUUID();
    const result = await user.client.rpc("complete_onboarding", {
      p_pregnancy_id: pregnancy,
      p_lmp_date: null,
      p_estimated_due_date: null,
      p_due_date_source: "unknown",
      p_clinician_confirmed_at: null,
      p_timezone: "UTC",
      p_pregnancy_type: "singleton",
      p_display_name: "Synthetic flow",
      p_theme_preference: "system",
      p_measurement_system: "metric",
      p_editorial_updates_enabled: false,
      p_appointment_reminders_enabled: false,
      p_planning_reminders_enabled: false,
    });
    assert.ifError(result.error);
    assert.equal(result.data, pregnancy);
    return pregnancy;
  };
  const callAccount = async (user, body, method = "POST", token) => {
    const access =
      token ?? (user ? (await session(user.client))?.access_token : h.anonKey);
    const response = await fetch(`${h.apiUrl}/functions/v1/account-data`, {
      method,
      headers: {
        Authorization: `Bearer ${access}`,
        apikey: h.anonKey,
        "Content-Type": "application/json",
      },
      body: ["GET", "OPTIONS"].includes(method)
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    return {
      status: response.status,
      headers: response.headers,
      data: response.status === 204 ? null : await response.json(),
    };
  };

  await h.scenario(
    "new-account-email-code-delivery-and-onboarding",
    async ({ users }) => {
      const user = {
        email: `signup-${randomUUID()}@example.invalid`,
        client: h.client(),
      };
      try {
        const mail = await requestEmail(user);
        assert.equal(await session(user.client), null);
        await auth(user.client).verifyEmailOtp(user.email, mail.otp);
        user.id = (await user.client.auth.getUser()).data.user.id;
        users.push(user.id);
        await onboard(user);
      } finally {
        // Track the unconfirmed signup too if verification fails.
        if (!user.id) {
          const found = await h.admin.auth.admin.listUsers({ perPage: 1000 });
          const account = found.data.users.find((u) => u.email === user.email);
          if (account) users.push(account.id);
        }
      }
    },
  );
  await h.scenario(
    "returning-email-code-normalizes-case-and-spaces",
    async ({ fresh }) => {
      const user = await fresh();
      await auth(user.client).requestEmailAuthentication(
        `  ${user.email.toUpperCase()}  `,
      );
      const mail = await h.mail.read(user.email);
      await auth(user.client).verifyEmailOtp(
        ` ${user.email.toUpperCase()} `,
        ` ${mail.otp} `,
      );
      assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
    },
  );
  for (const variant of ["wrong-code", "other-email", "reused-code"])
    await h.scenario(`email-rejects-${variant}`, async ({ fresh }) => {
      const user = await fresh(),
        mail = await requestEmail(user);
      if (variant === "reused-code") {
        await auth(user.client).verifyEmailOtp(user.email, mail.otp);
        await auth(user.client).signOutCurrentSession();
      }
      const target =
        variant === "other-email" ? (await fresh()).email : user.email;
      const wrong = mail.otp === "000000" ? "111111" : "000000";
      await assert.rejects(
        auth(user.client).verifyEmailOtp(
          target,
          variant === "wrong-code" ? wrong : mail.otp,
        ),
      );
      assert.equal(await session(user.client), null);
    });
  await h.scenario("email-resend-replaces-previous-code", async ({ fresh }) => {
    const user = await fresh();
    const first = await requestEmail(user);
    const second = await requestEmail(user);
    assert.notEqual(first.otp, second.otp);
    await assert.rejects(
      auth(user.client).verifyEmailOtp(user.email, first.otp),
    );
    await auth(user.client).verifyEmailOtp(user.email, second.otp);
    assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
  });
  await h.scenario(
    "expired-email-code-is-rejected-by-real-auth",
    async ({ fresh }) => {
      const user = await fresh(),
        mail = await requestEmail(user);
      await h.sql(
        `update auth.users set confirmation_sent_at=now()-interval '2 hours', recovery_sent_at=now()-interval '2 hours' where id='${user.id}';`,
      );
      await assert.rejects(
        auth(user.client).verifyEmailOtp(user.email, mail.otp),
      );
      assert.equal(await session(user.client), null);
    },
  );
  await h.scenario(
    "magic-link-creates-session-through-production-callback",
    async ({ fresh }) => {
      const user = await fresh(),
        mail = await requestEmail(user);
      await auth(user.client).createSessionFromUrl(await follow(mail.link));
      assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
    },
  );
  await h.scenario(
    "token-hash-callback-verifies-real-email-token",
    async ({ fresh }) => {
      const user = await fresh(),
        mail = await requestEmail(user);
      const link = new URL(mail.link);
      await auth(user.client).createSessionFromUrl(
        `${h.apiUrl}/callback?token_hash=${link.searchParams.get("token")}&type=${link.searchParams.get("type")}`,
      );
      assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
    },
  );
  await h.scenario(
    "magic-link-replay-does-not-create-another-session",
    async ({ fresh }) => {
      const user = await fresh(),
        mail = await login(user);
      await auth(user.client).signOutCurrentSession();
      const callback = await follow(mail.link);
      await assert.rejects(auth(user.client).createSessionFromUrl(callback));
      assert.equal(await session(user.client), null);
    },
  );
  for (const variation of ["exchange", "missing-verifier", "replayed-code"])
    await h.scenario(`pkce-${variation}`, async ({ fresh }) => {
      const user = await fresh();
      const map = new Map();
      const storage = {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => map.set(key, value),
        removeItem: (key) => map.delete(key),
      };
      user.client = h.client({ pkce: true, storage });
      const mail = await requestEmail(user),
        callback = await follow(mail.link);
      assert.ok(new URL(callback).searchParams.get("code"));
      if (variation === "missing-verifier") {
        await assert.rejects(
          auth(h.client({ pkce: true })).createSessionFromUrl(callback),
        );
        return;
      }
      await auth(user.client).createSessionFromUrl(callback);
      assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
      if (variation === "replayed-code")
        await assert.rejects(auth(user.client).createSessionFromUrl(callback));
    });
  await h.scenario(
    "refresh-rotates-session-and-signout-revokes-refresh",
    async ({ fresh }) => {
      const user = await fresh();
      await login(user);
      const first = await session(user.client);
      const next = await user.client.auth.refreshSession();
      assert.ifError(next.error);
      assert.notEqual(first.refresh_token, next.data.session.refresh_token);
      assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
      const token = next.data.session.refresh_token;
      await auth(user.client).signOutCurrentSession();
      assert.equal(await session(user.client), null);
      assert.ok(
        (await h.client().auth.refreshSession({ refresh_token: token })).error,
      );
    },
  );
  await h.scenario(
    "session-restores-in-new-client-and-signout-clears-storage",
    async ({ fresh }) => {
      const user = await fresh(),
        map = new Map();
      const storage = {
        getItem: (k) => map.get(k) ?? null,
        setItem: (k, v) => map.set(k, v),
        removeItem: (k) => map.delete(k),
      };
      user.client = h.client({ storage });
      await login(user);
      const reopened = h.client({ storage });
      assert.equal((await reopened.auth.getUser()).data.user.id, user.id);
      await auth(reopened).signOutCurrentSession();
      assert.equal(await session(h.client({ storage })), null);
      assert.equal(map.size, 0);
    },
  );
  await h.scenario(
    "recovery-email-establishes-recovery-session",
    async ({ fresh }) => {
      const user = await fresh();
      await auth(user.client).requestAccountRecovery(user.email);
      const mail = await h.mail.read(user.email),
        callback = await follow(mail.link);
      assert.equal(new URL(callback).hash.includes("type=recovery"), true);
      await auth(user.client).createSessionFromUrl(callback);
      assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
    },
  );
  await h.scenario("unknown-recovery-address-does-not-send-email", async () => {
    await auth(h.client()).requestAccountRecovery(
      `unknown-${randomUUID()}@example.invalid`,
    );
    assert.equal(h.mail.messages.length, 0);
  });
  await h.scenario("recovery-email-link-is-single-use", async ({ fresh }) => {
    const user = await fresh();
    await auth(user.client).requestAccountRecovery(user.email);
    const mail = await h.mail.read(user.email);
    await auth(user.client).createSessionFromUrl(await follow(mail.link));
    await auth(user.client).signOutCurrentSession();
    await assert.rejects(
      auth(user.client).createSessionFromUrl(await follow(mail.link)),
    );
    assert.equal(await session(user.client), null);
  });
  await h.scenario(
    "local-smtp-refuses-non-test-recipient",
    async ({ fresh }) => {
      const user = await fresh();
      await login(user);
      const change = await user.client.auth.updateUser({
        email: `blocked-${randomUUID()}@example.com`,
      });
      assert.ok(change.error, "Local SMTP must reject an external recipient");
      assert.ok(
        h.mail.messages.every((m) =>
          m.recipients.every((e) => e.endsWith("@example.invalid")),
        ),
      );
      assert.equal(
        (await user.client.auth.getUser()).data.user.email,
        user.email,
      );
    },
  );
  await h.scenario(
    "invalid-email-does-not-send-email-or-create-session",
    async () => {
      const c = h.client();
      await assert.rejects(auth(c).requestEmailAuthentication("invalid-email"));
      assert.equal(h.mail.messages.length, 0);
      assert.equal(await session(c), null);
    },
  );
  await h.scenario(
    "real-login-token-enforces-database-owner-isolation",
    async ({ fresh }) => {
      const owner = await fresh(),
        stranger = await fresh();
      await login(owner);
      await login(stranger);
      await onboard(owner);
      const own = await owner.client.from("pregnancies").select("id");
      assert.ifError(own.error);
      assert.equal(own.data.length, 1);
      const foreign = await stranger.client.from("pregnancies").select("id");
      assert.ifError(foreign.error);
      assert.equal(foreign.data.length, 0);
    },
  );
  for (const type of ["anonymous", "invalid-token"])
    await h.scenario(`account-export-rejects-${type}`, async () => {
      const r = await callAccount(
        null,
        { action: "export" },
        "POST",
        type === "invalid-token" ? "invalid-token" : undefined,
      );
      assert.equal(r.status, 401);
    });
  await h.scenario(
    "account-export-contains-only-current-user-and-no-cache",
    async ({ fresh }) => {
      const owner = await fresh(),
        stranger = await fresh();
      await login(owner);
      await login(stranger);
      await onboard(owner);
      await onboard(stranger);
      const result = await callAccount(owner, {
        action: "export",
        ownerId: stranger.id,
      });
      assert.equal(result.status, 200);
      assert.equal(result.headers.get("cache-control"), "no-store");
      assert.equal(result.data.export.account.email, owner.email);
      assert.ok(!JSON.stringify(result.data).includes(stranger.id));
      assert.ok(!JSON.stringify(result.data).includes(stranger.email));
      const audit = await h.admin
        .from("access_audit_events")
        .select("event_type")
        .eq("actor_user_id", owner.id)
        .eq("event_type", "account.exported");
      assert.ifError(audit.error);
      assert.equal(audit.data.length, 1);
    },
  );
  for (const confirmation of ["", "delete", " DELETE ", "Delete", null])
    await h.scenario(
      `account-delete-requires-exact-confirmation-${JSON.stringify(confirmation)}`,
      async ({ fresh }) => {
        const user = await fresh();
        await login(user);
        await onboard(user);
        const r = await callAccount(user, {
          action: "deleteAccount",
          confirmation,
        });
        assert.equal(r.status, 400);
        assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
        const jobs = await h.admin
          .from("deletion_jobs")
          .select("id")
          .eq("owner_id", user.id);
        assert.ifError(jobs.error);
        assert.equal(jobs.data.length, 0);
      },
    );
  for (const body of ["{broken", "[]", "null", '{"action":"unknown"}'])
    await h.scenario(
      `account-rejects-invalid-body-${body}`,
      async ({ fresh }) => {
        const user = await fresh();
        await login(user);
        assert.equal((await callAccount(user, body)).status, 400);
        assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
      },
    );
  await h.scenario(
    "account-delete-removes-auth-records-and-revokes-session",
    async ({ fresh }) => {
      const user = await fresh(),
        stranger = await fresh();
      await login(user);
      await login(stranger);
      const pregnancy = await onboard(user);
      await onboard(stranger);
      const before = await session(user.client);
      const r = await callAccount(user, {
        action: "deleteAccount",
        confirmation: "DELETE",
        ownerId: stranger.id,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.status, "deleted");
      assert.ok((await h.admin.auth.admin.getUserById(user.id)).error);
      for (const [table, column, value] of [
        ["profiles", "id", user.id],
        ["pregnancies", "id", pregnancy],
        ["user_preferences", "owner_id", user.id],
        ["notification_preferences", "owner_id", user.id],
      ]) {
        const rows = await h.admin.from(table).select("*").eq(column, value);
        assert.ifError(rows.error);
        assert.equal(rows.data.length, 0, `${table} cascaded`);
      }
      assert.ok((await user.client.auth.getUser(before.access_token)).error);
      assert.ok(
        (
          await h
            .client()
            .auth.refreshSession({ refresh_token: before.refresh_token })
        ).error,
      );
      assert.equal(
        (await stranger.client.auth.getUser()).data.user.id,
        stranger.id,
      );
      assert.equal(
        (
          await callAccount(
            user,
            { action: "deleteAccount", confirmation: "DELETE" },
            "POST",
            before.access_token,
          )
        ).status,
        401,
      );
    },
  );
  for (const table of ["documents", "media_assets"])
    await h.scenario(
      `account-delete-stops-when-storage-is-down-${table}`,
      async ({ fresh }) => {
        const user = await fresh();
        await login(user);
        const pregnancy = await onboard(user),
          id = randomUUID();
        const row = {
          id,
          pregnancy_id: pregnancy,
          owner_id: user.id,
          storage_bucket:
            table === "documents" ? "tender-documents" : "tender-media",
          storage_path: `${id}/${randomUUID()}.${table === "documents" ? "pdf" : "jpg"}`,
          mime_type: table === "documents" ? "application/pdf" : "image/jpeg",
          byte_size: 100,
          ...(table === "documents"
            ? { title: "Synthetic document", document_type: "other" }
            : {}),
        };
        const insert = await h.admin.from(table).insert(row);
        assert.ifError(insert.error);
        const r = await callAccount(user, {
          action: "deleteAccount",
          confirmation: "DELETE",
        });
        assert.equal(r.status, 500);
        assert.equal(r.data.error, "deletion_failed");
        assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
        const rows = await h.admin.from(table).select("id").eq("id", id);
        assert.ifError(rows.error);
        assert.equal(rows.data.length, 1);
        const jobs = await h.admin
          .from("deletion_jobs")
          .select("status,failure_code")
          .eq("owner_id", user.id);
        assert.ifError(jobs.error);
        assert.deepEqual(jobs.data, [
          { status: "failed", failure_code: "storage_delete_failed" },
        ]);
      },
    );
}

if (process.argv[1]?.endsWith("run.mjs")) {
  let harness;
  try {
    harness = await createServiceHarness();
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, async () => {
        harness.report.setupError = `Interrupted by ${signal}`;
        await harness.close();
        process.exit(130);
      });
    await runServiceFlows(harness);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (harness && (await harness.close()).status !== "passed")
      process.exitCode = 1;
  }
}
