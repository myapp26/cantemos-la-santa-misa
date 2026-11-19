// Edge Function: recibe el webhook de Hotmart cuando una compra se aprueba,
// genera automaticamente una clave de acceso (misma logica que scripts/keys.js)
// y AVISA A LA ADMINISTRADORA por email (Resend) con el link listo para
// enviarlo al comprador por WhatsApp. Ya NO le escribe al comprador.
//
// Desplegar: Supabase Dashboard -> Edge Functions -> hotmart-webhook -> pegar
// este codigo (o `supabase functions deploy hotmart-webhook --no-verify-jwt`
// si se instala el CLI).
//
// Variables de entorno necesarias (Supabase Dashboard -> Edge Functions ->
// Secrets; SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya existen porque las
// usa validate-key):
//   HOTMART_HOTTOK    -- token de "Autentificacion" del Webhook en Hotmart
//   RESEND_API_KEY    -- API key de Resend
//   NOTIFY_EMAIL      -- correo de la administradora que recibe el aviso de
//                        venta (obligatorio; no se escribe en el codigo)
//   RESEND_FROM       -- remitente verificado en Resend, ej:
//                        "Cantemos la Santa Misa <acceso@tudominio.com>"
//                        (mientras no haya dominio propio verificado, usar
//                        "onboarding@resend.dev" -- pero ese remitente SOLO
//                        entrega al correo con el que se creo la cuenta de
//                        Resend, no sirve para compradores reales).

import { createClient } from "jsr:@supabase/supabase-js@2";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1 (igual que keys.js)

// Codigo de oferta de Hotmart -> tier de la clave (ver claves.js / ADMIN.md).
const OFERTA_A_TIER: Record<string, "freemium" | "premium"> = {
  mitpoddh: "freemium", // Plan Mensual
  loqos412: "premium", // Plan Anual Premium
};

function randomGroup(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

function generateKeyCode(): string {
  return `CSM-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

function esc(t: string | undefined): string {
  return (t || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function avisoHtml(
  buyerName: string | undefined,
  buyerEmail: string,
  phone: string | undefined,
  plan: string,
  link: string,
): string {
  const digits = (phone || "").replace(/\D/g, "");
  const waNum = digits.length === 10 ? `57${digits}` : digits; // Colombia: 10 digitos -> +57
  const mensaje =
    `¡Gracias por tu compra! 🎵 Este es tu acceso a "Cantemos para la Santa Misa": ${link} ` +
    `Ábrelo desde el celular donde vas a usar la app y toca "Activar".`;
  const waLink = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(mensaje)}` : "";
  return `
    <p><strong>Nueva venta en Hotmart</strong> 🎉</p>
    <p>Comprador: ${esc(buyerName) || "(sin nombre)"}<br>
    Correo: ${esc(buyerEmail)}<br>
    Celular: ${esc(phone) || "(Hotmart no lo envio)"}<br>
    Plan: ${esc(plan)}</p>
    <p>Mensaje para enviar por WhatsApp (copiar y pegar):</p>
    <p style="background:#f4f4f4;padding:8px">${esc(mensaje)}</p>
    ${waLink ? `<p><a href="${waLink}">Abrir WhatsApp con el mensaje listo</a> (verifica que el numero sea correcto)</p>` : ""}
    <p>Link directo: <a href="${link}">${link}</a></p>
  `;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  // 1) Autenticar: Hotmart manda en este header el token configurado en
  // la pestana "Autentificacion" del Webhook.
  const hottok = req.headers.get("x-hotmart-hottok");
  const expected = Deno.env.get("HOTMART_HOTTOK");
  if (!expected || hottok !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad_request", { status: 400 });
  }

  // Log completo -- util para confirmar el formato real la primera vez
  // (revisar en Supabase Dashboard -> Edge Functions -> hotmart-webhook -> Logs).
  console.log("hotmart-webhook payload:", JSON.stringify(payload));

  const event = payload?.event;
  if (event !== "PURCHASE_APPROVED") {
    // Otros eventos (reembolso, cancelacion, etc.) no generan clave aca.
    return new Response("ignored", { status: 200 });
  }

  const buyerEmail: string | undefined = payload?.data?.buyer?.email;
  const buyerName: string | undefined = payload?.data?.buyer?.name;
  const offerCode: string | undefined = payload?.data?.purchase?.offer?.code;
  const buyerPhone: string | undefined =
    payload?.data?.buyer?.checkout_phone || payload?.data?.buyer?.phone;

  if (!buyerEmail) {
    console.error("hotmart-webhook: sin email de comprador en el payload");
    return new Response("bad_request", { status: 400 });
  }

  // Correo de la administradora: solo viene de la variable secreta NOTIFY_EMAIL.
  // Se revisa ANTES de crear la clave para no dejar una venta sin aviso.
  const notifyEmail = Deno.env.get("NOTIFY_EMAIL");
  if (!notifyEmail) {
    console.error("hotmart-webhook: falta el secreto NOTIFY_EMAIL");
    return new Response("server_misconfigured", { status: 500 });
  }

  const tier = (offerCode && OFERTA_A_TIER[offerCode]) || "freemium";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let keyCode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    keyCode = generateKeyCode();
    const { data: existing } = await supabase
      .from("access_keys")
      .select("id")
      .eq("key_code", keyCode)
      .maybeSingle();
    if (!existing) break;
  }

  const { error: insertError } = await supabase
    .from("access_keys")
    .insert({
      key_code: keyCode,
      note: `Venta Hotmart - ${buyerName || buyerEmail} - oferta ${offerCode || "?"}`,
      is_admin: false,
      tier,
    });

  if (insertError) {
    console.error("hotmart-webhook: error creando clave", insertError.message);
    return new Response("server_error", { status: 500 });
  }

  const link = `https://cantemos-la-santa-misa.netlify.app/?key=${keyCode}`;

  // 2) Avisar a la administradora (NO al comprador), via Resend.
  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") || "onboarding@resend.dev",
      to: notifyEmail,
      subject: `Nueva venta: ${buyerName || buyerEmail} - enviar clave por WhatsApp`,
      html: avisoHtml(
        buyerName,
        buyerEmail,
        buyerPhone,
        tier === "premium" ? "Plan Anual Premium" : "Plan Mensual",
        link,
      ),
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text();
    console.error("hotmart-webhook: error enviando aviso", errText);
    // La clave ya quedo creada -- no se pierde la venta aunque el email
    // falle. Revisar los logs y buscar la clave con `keys.js list` y enviar el link por WhatsApp.
    return new Response("key_created_notify_failed", { status: 200 });
  }

  return new Response("ok", { status: 200 });
});
