/**
 * =============================================================
 *  CANTEMOS PARA LA SANTA MISA — VALIDACIÓN DE CLAVE (SERVERLESS)
 * =============================================================
 * Netlify Function. Reemplaza comparar la clave dentro del JS del
 * navegador (visible para cualquiera) por una validación en el
 * servidor, donde la clave real nunca se expone.
 *
 * Variables de entorno requeridas (Netlify → Site settings →
 * Environment variables):
 *   CLAVE_ACCESO   -> tu clave de acceso real
 *   TOKEN_SECRET   -> cadena aleatoria larga para firmar tokens
 *                     (genera una con:
 *                      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
 *
 * Nunca subas estos valores al repositorio (van solo en el panel
 * de Netlify, no en netlify.toml ni en el código).
 * =============================================================
 */
const crypto = require("crypto");

const RETRASO_MS = 700; // fricción anti fuerza bruta
const DIAS_SESION = 30;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return respuesta(405, { ok: false, error: "Método no permitido" });
  }

  // Fricción deliberada: hace que probar muchas claves seguidas
  // sea lento. No sustituye un límite de intentos real, pero
  // ayuda contra scripts básicos de fuerza bruta.
  await new Promise((r) => setTimeout(r, RETRASO_MS));

  let clave;
  try {
    ({ clave } = JSON.parse(event.body || "{}"));
  } catch (e) {
    return respuesta(400, { ok: false, error: "Cuerpo de la petición inválido" });
  }

  const CLAVE_REAL = process.env.CLAVE_ACCESO;
  const TOKEN_SECRET = process.env.TOKEN_SECRET;

  if (!CLAVE_REAL || !TOKEN_SECRET) {
    return respuesta(500, {
      ok: false,
      error:
        "Faltan variables de entorno CLAVE_ACCESO / TOKEN_SECRET en Netlify",
    });
  }

  if (typeof clave !== "string" || !compararSeguro(clave, CLAVE_REAL)) {
    return respuesta(401, { ok: false, error: "Clave incorrecta" });
  }

  const token = generarToken(TOKEN_SECRET);
  return respuesta(200, { ok: true, token });
};

// Comparación de tiempo constante: evita que un atacante deduzca
// la clave midiendo cuánto tarda la respuesta según cuántos
// caracteres acertó.
function compararSeguro(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // igual gastamos el mismo tiempo
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Token firmado (HMAC-SHA256) sin estado en servidor: cualquier
// instancia de la función puede verificarlo con el mismo secreto,
// funciona igual desde cualquier dispositivo/navegador.
function generarToken(secret) {
  const exp = Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const firma = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${firma}`;
}

function respuesta(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
