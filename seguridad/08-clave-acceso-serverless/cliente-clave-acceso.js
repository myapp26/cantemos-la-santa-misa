/**
 * =============================================================
 *  CANTEMOS PARA LA SANTA MISA — CLIENTE DE CLAVE DE ACCESO
 * =============================================================
 * Reemplaza tu comparación de clave fija en el JS por esto. La
 * clave real ya NO viaja en el código del navegador; se valida
 * en netlify/functions/verificar-clave.js.
 *
 * USO — al enviar el formulario de clave:
 *   const ok = await CantemosAcceso.iniciarSesion(claveEscrita);
 *   if (ok) { mostrarApp(); } else { mostrarError(); }
 *
 * USO — al abrir la app (para no pedir clave si ya inició sesión
 * antes en ese dispositivo/navegador):
 *   const activa = await CantemosAcceso.sesionActiva();
 *   if (activa) { mostrarApp(); } else { mostrarFormularioClave(); }
 *
 * USO — cerrar sesión (opcional, si agregas un botón "salir"):
 *   CantemosAcceso.cerrarSesion();
 * =============================================================
 */
(function () {
  "use strict";

  const CLAVE_STORAGE = "cantemos_token";

  async function iniciarSesion(clave) {
    try {
      const resp = await fetch("/.netlify/functions/verificar-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      const datos = await resp.json();
      if (datos.ok && datos.token) {
        localStorage.setItem(CLAVE_STORAGE, datos.token);
        return true;
      }
      return false;
    } catch (e) {
      console.warn("[cantemos-la-santa-misa] Error validando clave:", e);
      return false;
    }
  }

  function base64urlDecode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    return atob(str);
  }

  function expiraLocal(token) {
    try {
      const [payload] = token.split(".");
      const { exp } = JSON.parse(base64urlDecode(payload));
      return exp || 0;
    } catch (e) {
      return 0;
    }
  }

  async function sesionActiva() {
    const token = localStorage.getItem(CLAVE_STORAGE);
    if (!token) return false;

    const exp = expiraLocal(token);
    if (!exp || Date.now() > exp) {
      localStorage.removeItem(CLAVE_STORAGE);
      return false;
    }

    // Con conexión: revalida contra el servidor (detecta tokens
    // manipulados/falsificados, ya que solo el servidor tiene el
    // secreto para firmarlos).
    // Sin conexión (uso offline típico de una PWA): confiamos en
    // la expiración local ya comprobada arriba, para no bloquear
    // a un usuario legítimo sin internet.
    try {
      const resp = await fetch("/.netlify/functions/verificar-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const datos = await resp.json();
      if (!datos.valido) localStorage.removeItem(CLAVE_STORAGE);
      return !!datos.valido;
    } catch (e) {
      return true;
    }
  }

  function cerrarSesion() {
    localStorage.removeItem(CLAVE_STORAGE);
  }

  window.CantemosAcceso = { iniciarSesion, sesionActiva, cerrarSesion };
})();
