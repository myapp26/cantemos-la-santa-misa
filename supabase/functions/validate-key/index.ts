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

// Re-vinculo automatico para claves normales (2/11/2026): un cliente real
// perdio el acceso en un celular donde ya tenia la clave activada porque el
// navegador le borro el localStorage (reinstalo la app, limpio datos, el
// sistema libero espacio) -- el token local desaparecio, pero la persona
// seguia sabiendo su codigo de clave de memoria. Sin esto, la unica forma
// de recuperar el acceso era que Gloria corriera `node keys.js unbind` a
// mano por cada caso, uno por uno, para siempre.
// Se permite re-vincular sola una clave normal a un dispositivo nuevo, pero
// como maximo una vez cada REBIND_COOLDOWN_DIAS dias desde el ultimo
// vinculo -- no se decide por la huella del dispositivo (dos telefonos del
// mismo modelo pueden compartirla, ver mas abajo), sino por tiempo. Esto no
// vuelve las claves libremente compartibles: alguien que comparta una clave
// filtrada solo podria "turnarse" el acceso una vez por ese periodo, no a
// demanda -- sigue siendo fuerte disuasion sin dejar a un cliente legitimo
// varado a la espera de que Gloria libere la clave a mano.
const REBIND_COOLDOWN_DIAS = 30;
function puedeRevincularSolo(row: { bound_at: string | null }): boolean {
  if (!row.bound_at) return true; // por si algun dato viejo no tiene fecha
  const diasDesdeVinculo = (Date.now() - new Date(row.bound_at).getTime()) / (1000 * 60 * 60 * 24);
  return diasDesdeVinculo >= REBIND_COOLDOWN_DIAS;
}

// Periodo de prueba para "beneficiario de uso exclusivo" (13/11/2026, a
// pedido de Gloria): una clave beneficiario funciona con paridad de
// Premium (nunca "privada", ver letraPermitidaCliente/beneficiarioVigente)
// solo durante TRIAL_BENEFICIARIO_DIAS. Ese plazo corre desde
// first_bound_at -- el momento en que el beneficiario activó la clave en
// su celular la primera y única vez -- y no desde created_at (cuando
// Gloria generó la clave) ni desde bound_at (que se pisa en cada
// re-vinculo por perdida de datos o re-vinculo de admin, ver
// REBIND_COOLDOWN_DIAS mas arriba). Aclarado explícitamente por Gloria el
// 13/11/2026 tras una corrección sobre su primera elección. Si la clave
// todavia no se activó en ningun dispositivo (first_bound_at es null), la
// prueba todavia no empezó y se trata como no vencida. Pasado el plazo, en
// vez de bloquear la clave (como "revoked"), baja sola a Demo: se le
// devuelve tier:"demo" en la respuesta sin tocar la fila en la base (el
// admin editor/`keys.js list` la sigue viendo como "beneficiario" para que
// Gloria pueda identificarla y, si quiere, extenderla a mano generando una
// clave nueva). El dispositivo ya vinculado lo ve solo en su próxima
// revalidación automática (revalidarAcceso() en index.html, cada vez que
// la app vuelve a primer plano) -- no hace falta tocar nada del lado del
// cliente ni republicar el sitio para que esto se propague.
const TRIAL_BENEFICIARIO_DIAS = 30;
function tierEfectivo(row: { tier: string; is_admin: boolean; first_bound_at: string | null }): string {
  if (row.is_admin) return row.tier; // un admin nunca expira, el tier no le aplica igual
  if (row.tier === "beneficiario" && row.first_bound_at) {
    const diasDesdeActivacion = (Date.now() - new Date(row.first_bound_at).getTime()) / (1000 * 60 * 60 * 24);
    if (diasDesdeActivacion >= TRIAL_BENEFICIARIO_DIAS) return "demo";
  }
  return row.tier;
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
      return json({ ok: true, is_admin: row.is_admin === true, tier: tierEfectivo(row) }, 200, origin);
    }
    // Sin token valido: por defecto se rechaza, aunque la huella "parezca"
    // la misma (dos telefonos del mismo modelo pueden tener huellas
    // identicas, asi que la huella nunca alcanza sola para probar que es el
    // mismo aparato). Las claves normales tienen una salida automatica mas
    // abajo (puedeRevincularSolo) para cuando el dueno legitimo perdio sus
    // datos locales; si todavia esta dentro del periodo de espera, el admin
    // puede liberar la clave a mano con `node keys.js unbind`.
    //
    // Excepcion: las claves is_admin son de la propia dueña de la app, no
    // de un cliente final. Ella sí necesita usarlas desde varios contextos
    // (perfiles de Chrome, ventanas de incognito, otra compu) sin depender
    // de correr `keys.js unbind` a mano cada vez. Como ya se confía en estas
    // claves para saltar el bloqueo desktop_blocked, re-vincularlas solas
    // (rotando el token) no abre una puerta nueva de riesgo distinta a la
    // que ya existe si la clave admin se filtra.
    if (row.is_admin) {
      const freshToken = newToken();
      const freshHash = await sha256Hex(freshToken);
      const { data: rebound, error: rebindError } = await supabase
        .from("access_keys")
        .update({
          device_fingerprint: fingerprint,
          device_token_hash: freshHash,
          bound_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select()
        .maybeSingle();
      if (rebindError || !rebound) {
        return json({ ok: false, reason: "server_error" }, 500, origin);
      }
      return json({ ok: true, token: freshToken, is_admin: true, tier: tierEfectivo(row) }, 200, origin);
    }
    if (puedeRevincularSolo(row)) {
      const freshToken = newToken();
      const freshHash = await sha256Hex(freshToken);
      const { data: rebound, error: rebindError } = await supabase
        .from("access_keys")
        .update({
          device_fingerprint: fingerprint,
          device_token_hash: freshHash,
          bound_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select()
        .maybeSingle();
      if (rebindError || !rebound) {
        return json({ ok: false, reason: "server_error" }, 500, origin);
      }
      return json({ ok: true, token: freshToken, is_admin: false, tier: tierEfectivo(row) }, 200, origin);
    }
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
      first_bound_at: new Date().toISOString(),
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

  return json({ ok: true, token: freshToken, is_admin: row.is_admin === true, tier: tierEfectivo(row) }, 200, origin);
});
