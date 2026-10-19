import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

export const scenarioCount = 14;
const visible = (text) => ({
  extendedWaitUntil: { visible: text, timeout: 30000 },
});
const tap = (text) => ({ tapOn: text });
const field = (label, text) => [
  { tapOn: { id: `field-${label}` } },
  { inputText: text },
  { hideKeyboard: {} },
];
const link = (url) => ({ openLink: { link: url, autoVerify: true } });
const privacy = [link("tender://privacy-data"), visible("Privacy and data")];
async function login(ctx, type = "magiclink") {
  const generated = await ctx.stack.admin.auth.admin.generateLink({
    type,
    email: ctx.user.email,
  });
  assert.ifError(generated.error);
  const url = `tender://auth/callback?token_hash=${generated.data.properties.hashed_token}&type=${type}`;
  await ctx.ui([
    link(url),
    visible(type === "recovery" ? "Choose a new password" : ".*"),
  ]);
  return url;
}
async function signedIn(ctx) {
  await login(ctx);
  await ctx.ui(privacy);
}
async function accountExists(ctx) {
  assert.equal(
    (await ctx.stack.admin.auth.admin.getUserById(ctx.user.id)).data.user?.id,
    ctx.user.id,
  );
}
async function readMail(ctx) {
  for (let i = 0; i < 40; i++) {
    // Supabase CLI local SMTP uses Mailpit in newer versions and Inbucket in older versions.
    const base = ctx.stack.mailUrl;
    const list = await fetch(`${base}/api/v1/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const item = list?.messages?.find((m) =>
      m.To?.some((to) => to.Address === ctx.user.email),
    );
    if (item) {
      const mail = await fetch(`${base}/api/v1/message/${item.ID}`).then((r) =>
        r.json(),
      );
      return `${mail.Text}\n${mail.HTML}`;
    }
    const inbox = ctx.user.email.split("@")[0];
    const old = await fetch(`${base}/api/v1/mailbox/${inbox}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (Array.isArray(old) && old.length) {
      const mail = await fetch(
        `${base}/api/v1/mailbox/${inbox}/${old.at(-1).id}`,
      ).then((r) => r.json());
      return `${mail.body.text}\n${mail.body.html}`;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Disposable mailbox did not receive the requested email");
}
export async function runFlows({ scenario }) {
  await scenario("empty-email", async (c) => {
    await c.ui([
      tap("Email me a sign-in link or code"),
      visible("Enter a valid email address."),
      { assertNotVisible: "Check your email" },
    ]);
  });
  await scenario("invalid-email", async (c) => {
    await c.ui([
      ...field("email-address", "invalid-address"),
      tap("Email me a sign-in link or code"),
      visible("Enter a valid email address."),
    ]);
  });
  await scenario("recovery-navigation", async (c) => {
    await c.ui([
      tap("Recover account access"),
      visible("Send recovery email"),
      tap("Send recovery email"),
      visible("Enter a valid email address."),
      tap("Back"),
      visible("Welcome to Flutterings"),
    ]);
  });
  await scenario("password-route-requires-recovery", async (c) => {
    await c.ui([
      link("tender://auth/update-password"),
      visible("Recovery session required"),
      tap("Request a new recovery link"),
      visible("Send recovery email"),
    ]);
  });
  await scenario("malformed-callback", async (c) => {
    await c.ui([
      link("tender://auth/callback?error=access_denied"),
      visible("We could not finish signing in"),
      tap("Return to sign in"),
      visible("Welcome to Flutterings"),
    ]);
  });
  await scenario("email-code-login", async (c) => {
    await c.ui([
      ...field("email-address", c.user.email),
      tap("Email me a sign-in link or code"),
      visible("Check your email"),
    ]);
    const mail = await readMail(c),
      code = mail.match(/\b\d{6,8}\b/)?.[0];
    assert.ok(code, "Email code must exist");
    await c.ui([
      {
        scrollUntilVisible: {
          element: { id: "field-one-time-code" },
          direction: "DOWN",
        },
      },
      ...field("one-time-code", code),
      tap("Verify code"),
      ...privacy,
    ]);
    assert.ok(
      (await c.stack.admin.auth.admin.getUserById(c.user.id)).data.user
        .last_sign_in_at,
    );
  });
  await scenario("invalid-email-code", async (c) => {
    await c.ui([
      ...field("email-address", c.user.email),
      tap("Email me a sign-in link or code"),
      visible("Check your email"),
      {
        scrollUntilVisible: {
          element: { id: "field-one-time-code" },
          direction: "DOWN",
        },
      },
      ...field("one-time-code", "000000"),
      tap("Verify code"),
      visible("That code could not be verified.*"),
    ]);
    await accountExists(c);
  });
  await scenario("recovery-email-request", async (c) => {
    await c.ui([
      tap("Recover account access"),
      ...field("email-address", c.user.email),
      tap("Send recovery email"),
      visible("If recovery is available, an email is on its way."),
    ]);
    assert.match(await readMail(c), /recover|reset/i);
  });
  await scenario("native-session-persists-restart", async (c) => {
    await signedIn(c);
    await c.ui([
      { stopApp: {} },
      { launchApp: { clearState: false } },
      ...privacy,
    ]);
    await accountExists(c);
  });
  await scenario("sign-out-cancel", async (c) => {
    await signedIn(c);
    await c.ui([
      tap("Sign out"),
      visible("Sign out of Flutterings."),
      tap("Stay signed in"),
      visible("Privacy and data"),
      { stopApp: {} },
      { launchApp: { clearState: false } },
      ...privacy,
    ]);
    await accountExists(c);
  });
  await scenario("sign-out-clears-session", async (c) => {
    await signedIn(c);
    await c.ui([
      tap("Sign out"),
      tap("Confirm sign out"),
      visible("Welcome to Flutterings"),
      { stopApp: {} },
      { launchApp: { clearState: false } },
      visible("Welcome to Flutterings"),
    ]);
    await accountExists(c);
  });
  await scenario("password-short-and-mismatch", async (c) => {
    await login(c, "recovery");
    await c.ui([
      ...field("new-password", "Aa1!short"),
      ...field("confirm-password", "Aa1!short"),
      tap("Update password"),
      visible("Use at least 12 characters."),
      { tapOn: { id: "field-new-password" } },
      { eraseText: 100 },
      { inputText: `Aa1!${randomBytes(12).toString("hex")}` },
      { hideKeyboard: {} },
      tap("Update password"),
      visible("Passwords do not match."),
    ]);
    assert.ifError(
      (
        await c.stack
          .client()
          .auth.signInWithPassword({
            email: c.user.email,
            password: c.user.password,
          })
      ).error,
    );
  });
  await scenario("password-replacement", async (c) => {
    await login(c, "recovery");
    const next = `Bb2@${randomBytes(24).toString("hex")}`;
    await c.ui([
      ...field("new-password", next),
      ...field("confirm-password", next),
      tap("Update password"),
      ...privacy,
    ]);
    assert.ifError(
      (
        await c.stack
          .client()
          .auth.signInWithPassword({ email: c.user.email, password: next })
      ).error,
    );
    assert.equal(
      (
        await c.stack
          .client()
          .auth.signInWithPassword({
            email: c.user.email,
            password: c.user.password,
          })
      ).error?.code,
      "invalid_credentials",
    );
  });
  await scenario("account-deletion", async (c) => {
    const other = await c.fresh();
    await signedIn(c);
    await c.ui([
      {
        scrollUntilVisible: { element: "Delete my account", direction: "DOWN" },
      },
      tap("Delete my account"),
      visible("Delete Flutterings account."),
      ...field("confirmation", "DELETE"),
      tap("Permanently delete account"),
      visible("Welcome to Flutterings"),
      { stopApp: {} },
      { launchApp: { clearState: false } },
      visible("Welcome to Flutterings"),
    ]);
    assert.ok((await c.stack.admin.auth.admin.getUserById(c.user.id)).error);
    assert.equal(
      (await c.stack.admin.auth.admin.getUserById(other.id)).data.user?.id,
      other.id,
    );
  });
}
