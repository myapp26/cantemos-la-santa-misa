// Edge Function: valida y vincula claves de acceso a un dispositivo.
// Desplegar con: supabase functions deploy validate-key --no-verify-jwt
// (es un endpoint publico anonimo, no hay sesiones de usuario en esta app).

import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://cantemos-la-santa-misa.netlify.app",
];

// Deploy previews y branch deploys de Netlify para ESTE sitio siguen el
// patron "https://<algo>--cantemos-la-santa-misa.netlify.app" (ej.
// deploy-preview-3--, nombre-de-rama--). Se aceptan por sufijo de host en
// vez de sumarlos uno a uno a ALLOWED_ORIGINS, igual que en el domain-lock
// del cliente (seguridad/02-anti-clonacion.js). Solo ese sufijo exacto: no
// habilita otros sitios de Netlify.
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

function looksLikeMobile(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(userAgent);
}

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ ok: false, reason: "method_not_allowed" }, 405, origin);
  }

  let body: { key?: string; fingerprint?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400, origin);
  }

  const keyCode = (body.key || "").trim().toUpperCase();
  const fingerprint = (body.fingerprint || "").trim();
  const token = (body.token || "").trim();

  if (!keyCode || !fingerprint) {
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
  if (!row) {
    return json({ ok: false, reason: "invalid" }, 404, origin);
  }
  if (row.status === "revoked") {
    return json({ ok: false, reason: "revoked" }, 403, origin);
  }

  if (row.status === "bound") {
    if (token && (await sha256Hex(token)) === row.device_token_hash) {
      return json({ ok: true }, 200, origin);
    }
    // Sin token valido: se rechaza, aunque la huella "parezca" la misma
    // (dos telefonos del mismo modelo pueden tener huellas identicas, asi
    // que la huella nunca alcanza sola para probar que es el mismo aparato).
    // Si el dueno legitimo perdio sus datos locales, el admin puede liberar
    // la clave con `node keys.js unbind` y reactivarla desde el celular.
    return json({ ok: false, reason: "in_use" }, 403, origin);
  }

  // row.status === "unused" -> intento de activacion (primer uso).
  // Las claves admin pueden activarse desde cualquier dispositivo; las
  // claves normales de cliente siguen restringidas a celular.
  const userAgent = req.headers.get("user-agent") || "";
  if (!row.is_admin && !looksLikeMobile(userAgent)) {
    return json({ ok: false, reason: "desktop_blocked" }, 403, origin);
  }

  const freshToken = newToken();
  const freshHash = await sha256Hex(freshToken);

  const { data: updated, error: updateError } = await supabase
    .from("access_keys")
    .update({
      status: "bound",
      device_fingerprint: fingerprint,
      device_token_hash: freshHash,
      bound_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "unused")
    .select()
    .maybeSingle();

  if (updateError) {
    return json({ ok: false, reason: "server_error" }, 500, origin);
  }
  if (!updated) {
    // Carrera: otro request se la llevo primero entre el select y el update.
    return json({ ok: false, reason: "in_use" }, 403, origin);
  }

  return json({ ok: true, token: freshToken }, 200, origin);
});
