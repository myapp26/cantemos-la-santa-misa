// Edge Function: entrega la letra completa de una cancion restringida
// (candado/oculta/premium) solo si la clave ya validada (validate-key) es
// premium o admin. Desplegar con: supabase functions deploy get-letra --no-verify-jwt
// (es un endpoint publico anonimo, no hay sesiones de usuario en esta app,
// igual que validate-key).
//
// Por que existe: canciones.js es un archivo publico servido con
// <script src="canciones.js"> -- cualquiera lo puede leer sin clave. Las
// canciones restringidas nunca llevan su letra ahi (ver publishFile() en
// index.html, que la publica vacia). Se piden aca, bajo demanda, una vez
// que la app ya tiene una clave+token vinculados via validate-key. Ver
// claude/analisis-tecnico-cancionero.md en el proyecto de Claude "App
// cancionero" (16/9/2026) para el contexto completo.

import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://cantemos-la-santa-misa.netlify.app",
];

// Mismo criterio de sufijo que validate-key y que el domain-lock del
// cliente (seguridad/02-anti-clonacion.js): acepta Deploy Previews y
// branch deploys de Netlify para este sitio.
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

  let body: { key?: string; token?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400, origin);
  }

  const keyCode = (body.key || "").trim().toUpperCase();
  const token = (body.token || "").trim();
  const cancionId = (body.id || "").trim();

  if (!keyCode || !token || !cancionId) {
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
    // Solo se sirve contenido a claves ya vinculadas (activadas al menos
    // una vez via validate-key) -- una clave "unused"/"revoked" nunca pasa
    // por aca en el flujo normal de la app.
    return json({ ok: false, reason: "invalid" }, 404, origin);
  }
  if ((await sha256Hex(token)) !== row.device_token_hash) {
    // Mismo criterio que validate-key: el token debe coincidir con el
    // dispositivo vinculado, la huella sola nunca alcanza.
    return json({ ok: false, reason: "invalid" }, 403, origin);
  }

  const autorizado = row.is_admin === true || row.tier === "premium";
  if (!autorizado) {
    return json({ ok: false, reason: "forbidden" }, 403, origin);
  }

  const { data: letraRow, error: letraError } = await supabase
    .from("letras_restringidas")
    .select("letra, solo_admin")
    .eq("id", cancionId)
    .maybeSingle();

  if (letraError) {
    return json({ ok: false, reason: "server_error" }, 500, origin);
  }
  if (!letraRow) {
    return json({ ok: false, reason: "not_found" }, 404, origin);
  }
  // Cantos "privada" (25/9/2026): solo el admin, nunca premium. Ver
  // migracion 0005_solo_admin.sql y esPrivada() en index.html.
  if (letraRow.solo_admin === true && row.is_admin !== true) {
    return json({ ok: false, reason: "forbidden" }, 403, origin);
  }

  return json({ ok: true, letra: letraRow.letra }, 200, origin);
});
