/**
 * =============================================================
 *  CANTEMOS PARA LA SANTA MISA — VERIFICACIÓN DE SESIÓN (SERVERLESS)
 * =============================================================
 * Valida el token que devolvió verificar-clave.js: firma HMAC +
 * expiración. Sin base de datos (stateless) — el mismo secreto en
 * el servidor puede validar el token venga de donde venga
 * (celular, laptop, cualquier navegador), sin guardar sesiones.
 * =============================================================
 */
const crypto = require("crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return respuesta(405, { valido: false });
  }

  let token;
  try {
    ({ token } = JSON.parse(event.body || "{}"));
  } catch (e) {
    return respuesta(400, { valido: false });
  }

  const TOKEN_SECRET = process.env.TOKEN_SECRET;
  if (!TOKEN_SECRET || typeof token !== "string") {
    return respuesta(200, { valido: false });
  }

  const partes = token.split(".");
  if (partes.length !== 2) return respuesta(200, { valido: false });
  const [payload, firma] = partes;

  const firmaEsperada = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  const bufFirma = Buffer.from(firma);
  const bufEsperada = Buffer.from(firmaEsperada);
  const firmaOk =
    bufFirma.length === bufEsperada.length &&
    crypto.timingSafeEqual(bufFirma, bufEsperada);

  if (!firmaOk) return respuesta(200, { valido: false });

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!exp || Date.now() > exp) return respuesta(200, { valido: false });
  } catch (e) {
    return respuesta(200, { valido: false });
  }

  return respuesta(200, { valido: true });
};

function respuesta(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
