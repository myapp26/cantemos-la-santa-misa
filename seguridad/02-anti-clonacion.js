/**
 * =============================================================
 *  CANTEMOS PARA LA SANTA MISA — MÓDULO ANTI-CLONACIÓN
 * =============================================================
 * 1) DOMAIN LOCK: la app solo funciona "completa" en los
 *    dominios que tú autorices. Si alguien copia el código y lo
 *    sube a otro dominio/hosting, la app lo detecta y muestra un
 *    aviso en vez de funcionar con normalidad.
 * 2) INTEGRIDAD: verifica que los archivos críticos no hayan
 *    sido alterados (útil para detectar hackeo/tampering en tu
 *    propio hosting también, no solo clones).
 *
 * IMPORTANTE — LÍMITES REALES:
 *  - Esto es un DISUASIVO, no una barrera infranqueable. Un
 *    atacante con conocimientos puede editar este mismo archivo
 *    y quitar la validación. Combínalo con ofuscación
 *    (06-build) para que sea más costoso de hacer.
 *  - La protección real de datos/lógica sensible siempre debe
 *    vivir en un backend/API, nunca solo en el navegador.
 *
 * CONFIGURA la lista DOMINIOS_AUTORIZADOS antes de publicar.
 * =============================================================
 */
(function () {
  "use strict";

  const SELLO = "cantemos-la-santa-misa";

  // -----------------------------------------------------------
  // ⚠️ CONFIGURACIÓN OBLIGATORIA: pon aquí tus dominios reales.
  // Incluye variantes: con/sin www, dominio de Firebase/Netlify/
  // Vercel si lo usas, y localhost para tus pruebas.
  // -----------------------------------------------------------
  const DOMINIOS_AUTORIZADOS = [
    "localhost",
    "127.0.0.1",
    "cantemos-la-santa-misa.netlify.app",
    // Si en el futuro agregas un dominio propio (ej. cantemoslasantamisa.com),
    // añádelo aquí también antes de apuntar el DNS a Netlify.
  ];

  // Deploy previews y branch deploys de Netlify para ESTE sitio siguen el
  // patrón "<algo>--cantemos-la-santa-misa.netlify.app" (ej. deploy-preview-1--,
  // nombre-de-rama--). Se aceptan por sufijo en vez de sumarlos uno a uno,
  // pero solo ese sufijo exacto: no habilita otros sitios de Netlify.
  const SUFIJO_PREVIEWS_NETLIFY = "--cantemos-la-santa-misa.netlify.app";

  // Archivos críticos a verificar por integridad (rutas relativas
  // desde la raíz del sitio). Añade aquí tu manifest, tu JS
  // principal, etc. Los hashes se calculan la primera vez que
  // ejecutes verificarIntegridadInicial() en consola y luego los
  // pegas en HASHES_ESPERADOS antes de publicar.
  const ARCHIVOS_CRITICOS = [
    // "/manifest.json",
    // "/app.js",
  ];
  const HASHES_ESPERADOS = {
    // "/manifest.json": "sha256-aquí...",
  };

  // -----------------------------------------------------------
  // Domain lock
  // -----------------------------------------------------------
  function dominioAutorizado() {
    const host = window.location.hostname;
    if (!DOMINIOS_AUTORIZADOS.length) return true; // sin configurar aún
    if (host.endsWith(SUFIJO_PREVIEWS_NETLIFY)) return true;
    return DOMINIOS_AUTORIZADOS.some(
      (d) => host === d || host.endsWith("." + d)
    );
  }

  function bloquearPorClon() {
    // No borramos el DOM (rompería accesibilidad/SEO por completo
    // de forma agresiva); en vez de eso mostramos un aviso claro
    // y dejamos evidencia + reporte opcional.
    const aviso = document.createElement("div");
    aviso.setAttribute("data-sello", SELLO);
    aviso.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:#111;color:#fff;" +
      "display:flex;align-items:center;justify-content:center;" +
      "text-align:center;padding:2rem;font-family:sans-serif;font-size:1.1rem;";
    aviso.innerHTML =
      `<div>⚠️ Esta es una copia no autorizada de "${SELLO}".<br>` +
      `Visita el sitio oficial para usar la app original.<br>` +
      `<small style="opacity:.6">dominio detectado: ${window.location.hostname}</small></div>`;
    document.addEventListener("DOMContentLoaded", () =>
      document.body ? document.body.appendChild(aviso) : null
    );
    console.warn(
      `[${SELLO}] Dominio no autorizado detectado: ${window.location.hostname}`
    );
    reportarClonDetectado(window.location.hostname);
  }

  // Reporte opcional a tu propio backend (si tienes uno). Deja
  // REPORTE_URL vacío si no quieres enviar nada; entonces solo
  // queda el log local en consola.
  const REPORTE_URL = ""; // ej: "https://tu-api.com/reporte-clon"
  function reportarClonDetectado(host) {
    if (!REPORTE_URL) return;
    try {
      fetch(REPORTE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sello: SELLO,
          host,
          url: window.location.href,
          fecha: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => {});
    } catch (e) {}
  }

  // -----------------------------------------------------------
  // Verificación de integridad de archivos (SHA-256 vía
  // crypto.subtle, disponible en todo navegador moderno/HTTPS).
  // -----------------------------------------------------------
  async function sha256(texto) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(texto)
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function verificarIntegridad() {
    for (const ruta of ARCHIVOS_CRITICOS) {
      try {
        const resp = await fetch(ruta, { cache: "no-store" });
        const texto = await resp.text();
        const hash = await sha256(texto);
        const esperado = HASHES_ESPERADOS[ruta];
        if (esperado && hash !== esperado) {
          console.warn(
            `[${SELLO}] ⚠️ Integridad alterada en ${ruta}. Esperado ${esperado.slice(
              0,
              12
            )}…, obtenido ${hash.slice(0, 12)}…`
          );
        }
      } catch (e) {
        // Silencioso: puede fallar por CORS/offline en PWA, no es
        // razón para bloquear la app.
      }
    }
  }

  // Utilidad para generar los hashes esperados la primera vez.
  // Ejecuta esto en consola (window.CantemosAntiClon.generarHashes())
  // y copia el resultado dentro de HASHES_ESPERADOS antes de publicar.
  async function generarHashes() {
    const resultado = {};
    for (const ruta of ARCHIVOS_CRITICOS) {
      try {
        const resp = await fetch(ruta, { cache: "no-store" });
        const texto = await resp.text();
        resultado[ruta] = await sha256(texto);
      } catch (e) {
        resultado[ruta] = "error: " + e.message;
      }
    }
    console.log(JSON.stringify(resultado, null, 2));
    return resultado;
  }

  // -----------------------------------------------------------
  // Init
  // -----------------------------------------------------------
  if (!dominioAutorizado()) {
    bloquearPorClon();
  }
  verificarIntegridad();

  window.CantemosAntiClon = {
    dominioAutorizado,
    verificarIntegridad,
    generarHashes,
  };
})();
