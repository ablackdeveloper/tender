// Only the server address changes. Execute the production handler in real Deno.
const serve = Deno.serve;
Deno.serve = ((handler: Deno.ServeHandler) =>
  serve(
    { hostname: "127.0.0.1", port: Number(Deno.env.get("TEST_FUNCTION_PORT")) },
    handler,
  )) as typeof Deno.serve;
await import("../../supabase/functions/account-data/index.ts");
