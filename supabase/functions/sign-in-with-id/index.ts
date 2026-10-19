import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

async function hashRateKey(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function requestIp(request: Request) {
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) return jsonResponse({ error: "Request is too large" }, 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  const nationalId =
    "national_id" in body && typeof body.national_id === "string" ? body.national_id.trim() : "";
  const password = "password" in body && typeof body.password === "string" ? body.password : "";
  if (nationalId.length > 32 || password.length > 128) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = request.headers.get("apikey");
  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    console.error("ID sign-in is missing required Supabase configuration");
    return jsonResponse({ error: "Unable to sign in right now" }, 503);
  }

  try {
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const idRateKey = await hashRateKey(serviceRoleKey, `id:${nationalId}`);
    const ipRateKey = await hashRateKey(serviceRoleKey, `ip:${requestIp(request)}`);

    const { data: ipAllowed, error: ipLimitError } = await serviceClient.rpc(
      "consume_id_signin_attempt",
      { _rate_key: ipRateKey, _max_attempts: 30, _window_seconds: 900 },
    );
    if (ipLimitError) {
      console.error("ID sign-in IP rate limit failed", ipLimitError.message);
      return jsonResponse({ error: "Unable to sign in right now" }, 503);
    }
    if (!ipAllowed) return jsonResponse({ error: "Too many attempts. Try again later." }, 429);

    const { data: idAllowed, error: idLimitError } = await serviceClient.rpc(
      "consume_id_signin_attempt",
      { _rate_key: idRateKey, _max_attempts: 8, _window_seconds: 900 },
    );
    if (idLimitError) {
      console.error("ID sign-in account rate limit failed", idLimitError.message);
      return jsonResponse({ error: "Unable to sign in right now" }, 503);
    }
    if (!idAllowed) return jsonResponse({ error: "Too many attempts. Try again later." }, 429);

    const idIsValid = /^\d{6,10}$/.test(nationalId);
    let email: string | null = null;
    if (idIsValid) {
      const { data, error } = await serviceClient.rpc("lookup_auth_email_by_national_id", {
        _national_id: nationalId,
      });
      if (error) {
        console.error("ID sign-in account lookup failed", error.message);
        return jsonResponse({ error: "Unable to sign in right now" }, 503);
      }
      email = data;
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(input instanceof Request ? input.headers : undefined);
          if (init?.headers)
            new Headers(init.headers).forEach((value, key) => headers.set(key, value));
          if (
            publishableKey.startsWith("sb_publishable_") &&
            headers.get("Authorization") === `Bearer ${publishableKey}`
          ) {
            headers.delete("Authorization");
          }
          headers.set("apikey", publishableKey);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const dummyEmail = `no-account-${idRateKey}@example.invalid`;
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: email ?? dummyEmail,
      password,
    });

    if (authError) {
      if (authError.status >= 500) {
        console.error("ID sign-in authentication service failed", authError.status);
        return jsonResponse({ error: "Unable to sign in right now" }, 503);
      }
      return jsonResponse({ error: "Invalid login credentials" }, 401);
    }
    if (!email || !authData.session) {
      return jsonResponse({ error: "Invalid login credentials" }, 401);
    }

    return new Response(
      JSON.stringify({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      }),
      {
        headers: {
          ...corsHeaders,
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("ID sign-in failed", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse({ error: "Unable to sign in right now" }, 503);
  }
});
