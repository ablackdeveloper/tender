import assert from "node:assert/strict";
import { productionAuth } from "./production-auth.mjs";

export const passwordScenarioCount = 20;

// Credentials come from the runner. Never write them to a report or assertion.
export async function runPasswordFlows(h, createPasswords) {
  const auth = (client) => productionAuth(client, `${h.apiUrl}/callback`);
  const scenario = (name, run) =>
    h.scenario(`password-${name}`, async (context) => {
      const passwords = await createPasswords();
      await run({ ...context, passwords });
    });
  const setInitial = async (user, password) => {
    const result = await h.admin.auth.admin.updateUserById(user.id, {
      password,
    });
    assert.ifError(result.error);
  };
  const signIn = async (user, password, accepted = true) => {
    const client = h.client();
    const result = await client.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (accepted) {
      assert.ifError(result.error);
      assert.equal(result.data.user.id, user.id);
      assert.equal((await client.auth.getUser()).data.user.id, user.id);
    } else {
      assert.equal(result.error?.code, "invalid_credentials");
      assert.equal(result.data.session, null);
      assert.equal((await client.auth.getSession()).data.session, null);
    }
    return client;
  };
  const follow = async (link) => {
    assert.equal(new URL(link).origin, h.apiUrl);
    const response = await fetch(link, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 303);
    const callback = response.headers.get("location");
    assert.equal(new URL(callback).origin, h.apiUrl);
    return callback;
  };
  const recoveryMail = async (user) => {
    const after = h.mail.messages.length;
    await auth(user.client).requestAccountRecovery(user.email);
    return h.mail.read(user.email, after);
  };
  const recover = async (user) => {
    const mail = await recoveryMail(user);
    await auth(user.client).createSessionFromUrl(await follow(mail.link));
    assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
    return mail;
  };

  await scenario(
    "replacement-accepts-new-and-rejects-old",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      await signIn(user, p.old);
      await recover(user);
      await auth(user.client).updateRecoveredPassword(p.next);
      await auth(user.client).signOutCurrentSession();
      await signIn(user, p.next);
      await signIn(user, p.old, false);
    },
  );
  await scenario(
    "email-only-account-can-set-first-password",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await signIn(user, p.next, false);
      await recover(user);
      await auth(user.client).updateRecoveredPassword(p.next);
      await signIn(user, p.next);
    },
  );
  await scenario(
    "same-password-rejected-without-lockout",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      await recover(user);
      await assert.rejects(auth(user.client).updateRecoveredPassword(p.old), {
        code: "same_password",
      });
      await signIn(user, p.old);
    },
  );
  const invalid = {
    empty: () => "",
    "eleven-characters": (p) => p.boundary.slice(0, 11),
    "missing-uppercase": (p) => p.next.toLowerCase(),
    "missing-lowercase": (p) => p.next.toUpperCase(),
    "missing-digit": (p) => p.next.replace(/[0-9]/g, "x"),
    "missing-symbol": (p) => p.next.replace(/[^A-Za-z0-9]/g, "x"),
  };
  for (const [name, value] of Object.entries(invalid))
    await scenario(
      `rejects-${name}-and-preserves-password`,
      async ({ fresh, passwords: p }) => {
        const user = await fresh();
        await setInitial(user, p.old);
        await recover(user);
        await assert.rejects(
          auth(user.client).updateRecoveredPassword(value(p)),
          { code: "weak_password" },
        );
        await signIn(user, p.old);
        await signIn(user, p.next, false);
      },
    );
  await scenario(
    "twelve-character-boundary-accepted",
    async ({ fresh, passwords: p }) => {
      assert.equal(p.boundary.length, 12);
      const user = await fresh();
      await recover(user);
      await auth(user.client).updateRecoveredPassword(p.boundary);
      await signIn(user, p.boundary);
    },
  );
  await scenario(
    "missing-session-cannot-change-password",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      await assert.rejects(auth(user.client).updateRecoveredPassword(p.next), {
        name: "AuthSessionMissingError",
      });
      await signIn(user, p.old);
      await signIn(user, p.next, false);
    },
  );
  await scenario(
    "signed-out-session-cannot-change-password",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      await recover(user);
      await auth(user.client).signOutCurrentSession();
      await assert.rejects(auth(user.client).updateRecoveredPassword(p.next), {
        name: "AuthSessionMissingError",
      });
      await signIn(user, p.old);
    },
  );
  await scenario(
    "expired-recovery-cannot-change-password",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      const mail = await recoveryMail(user);
      await h.sql(
        `update auth.users set recovery_sent_at=now()-interval '2 hours' where id='${user.id}';`,
      );
      await assert.rejects(
        auth(user.client).createSessionFromUrl(await follow(mail.link)),
      );
      await assert.rejects(auth(user.client).updateRecoveredPassword(p.next), {
        name: "AuthSessionMissingError",
      });
      await signIn(user, p.old);
    },
  );
  await scenario(
    "used-link-cannot-change-password-again",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      const mail = await recover(user);
      await auth(user.client).updateRecoveredPassword(p.next);
      const stranger = h.client();
      await assert.rejects(
        auth(stranger).createSessionFromUrl(await follow(mail.link)),
      );
      await assert.rejects(auth(stranger).updateRecoveredPassword(p.third), {
        name: "AuthSessionMissingError",
      });
      await signIn(user, p.next);
      await signIn(user, p.third, false);
    },
  );
  await scenario(
    "replacement-does-not-change-another-account",
    async ({ fresh, passwords: p }) => {
      const owner = await fresh(),
        other = await fresh();
      await setInitial(owner, p.old);
      await setInitial(other, p.third);
      const otherSession = await signIn(other, p.third);
      await recover(owner);
      await auth(owner.client).updateRecoveredPassword(p.next);
      await signIn(owner, p.next);
      await signIn(other, p.third);
      await signIn(other, p.next, false);
      assert.ifError((await otherSession.auth.refreshSession()).error);
    },
  );
  await scenario(
    "second-replacement-invalidates-both-prior-passwords",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      await recover(user);
      await auth(user.client).updateRecoveredPassword(p.next);
      await auth(user.client).signOutCurrentSession();
      await recover(user);
      await auth(user.client).updateRecoveredPassword(p.third);
      await signIn(user, p.third);
      await signIn(user, p.old, false);
      await signIn(user, p.next, false);
    },
  );
  await scenario(
    "email-code-still-works-after-replacement",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      await recover(user);
      await auth(user.client).updateRecoveredPassword(p.next);
      await auth(user.client).signOutCurrentSession();
      const after = h.mail.messages.length;
      await auth(user.client).requestEmailAuthentication(user.email);
      const mail = await h.mail.read(user.email, after);
      await auth(user.client).verifyEmailOtp(user.email, mail.otp);
      assert.equal((await user.client.auth.getUser()).data.user.id, user.id);
      await signIn(user, p.next);
    },
  );
  await scenario(
    "failed-change-can-retry-in-same-recovery-session",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      await recover(user);
      await assert.rejects(
        auth(user.client).updateRecoveredPassword(p.next.toLowerCase()),
        { code: "weak_password" },
      );
      await auth(user.client).updateRecoveredPassword(p.next);
      await signIn(user, p.next);
      await signIn(user, p.old, false);
    },
  );
  await scenario(
    "replacement-revokes-other-refresh-sessions",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      const oldSession = await signIn(user, p.old);
      const token = (await oldSession.auth.getSession()).data.session
        .refresh_token;
      await recover(user);
      await auth(user.client).updateRecoveredPassword(p.next);
      const revoked = await h
        .client()
        .auth.refreshSession({ refresh_token: token });
      assert.ok(revoked.error, "The old refresh session must be revoked");
      assert.equal(revoked.data.session, null);
      assert.ifError((await user.client.auth.refreshSession()).error);
    },
  );
  await scenario(
    "deleted-account-cannot-replace-or-use-password",
    async ({ fresh, passwords: p }) => {
      const user = await fresh();
      await setInitial(user, p.old);
      await recover(user);
      assert.ifError((await h.admin.auth.admin.deleteUser(user.id)).error);
      await assert.rejects(auth(user.client).updateRecoveredPassword(p.next));
      await signIn(user, p.old, false);
      await signIn(user, p.next, false);
    },
  );
}
