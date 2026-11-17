// Edge Function: entrega la clasificacion de riesgo de derechos de autor de
// TODAS las canciones, solo si la clave ya validada (validate-key) es de
// administrador. Desplegar con: supabase functions deploy get-riesgo --no-verify-jwt
// (endpoint publico anonimo, igual que get-letra y validate-key).
//
// Por que existe: esa clasificacion no debe viajar en canciones.js (archivo
// publico). Vive en la tabla riesgo_derechos (migracion 0008) y la llena
// scripts/sync-riesgo.js. Solo admin: ni premium, ni freemium, ni beneficiario.

import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://cantemos-la-santa-misa.netlify.app",
];
const PREVIEW_ORIGIN_HOST_SUFFIX = "--cantemos-la-santa-misa.netlify.app";

function allowedOrigins(): string[] {
  const extra = Deno.env.get("ALLOWED_ORIGINS");
  const fromEnv = extra ? extra.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return [...DEFAULT_ALLOWED_ORIGINS, ...fromEnv];
}

function origenAutorizado(origin: string): boolean {
  if (allowedOrigins().includes(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(PREVIEW_ORIGIN_HOST_SUFFIX);
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const matched = origin && origenAutorizado(origin) ? origin : allowedOrigins()[0];
  return {
    "Access-Control-Allow-Origin": matched,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ ok: false, reason: "method_not_allowed" }, 405, origin);
  }

  let body: { key?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400, origin);
  }

  const keyCode = (body.key || "").trim().toUpperCase();
  const token = (body.token || "").trim();
  if (!keyCode || !token) {
    return json({ ok: false, reason: "bad_request" }, 400, origin);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: row, error } = await supabase
    .from("access_keys")
    .select("*")
    .eq("key_code", keyCode)
    .maybeSingle();

  if (error) {
    return json({ ok: false, reason: "server_error" }, 500, origin);
  }
  if (!row || row.status !== "bound") {
    return json({ ok: false, reason: "invalid" }, 404, origin);
  }
  if ((await sha256Hex(token)) !== row.device_token_hash) {
    return json({ ok: false, reason: "invalid" }, 403, origin);
  }
  // Solo administrador (is_admin). Nadie mas, ni siquiera premium.
  if (row.is_admin !== true) {
    return json({ ok: false, reason: "forbidden" }, 403, origin);
  }

  const { data: filas, error: riesgoError } = await supabase
    .from("riesgo_derechos")
    .select("id, clasificacion, verificado, autor_final, fuente");

  if (riesgoError) {
    return json({ ok: false, reason: "server_error" }, 500, origin);
  }

  const riesgo: Record<string, { c: string; v: string | null; a: string | null; f: string | null }> = {};
  for (const f of filas || []) {
    riesgo[f.id] = { c: f.clasificacion, v: f.verificado, a: f.autor_final, f: f.fuente };
  }
  return json({ ok: true, riesgo }, 200, origin);
});
