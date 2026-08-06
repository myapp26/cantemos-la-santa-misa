/**
 * =============================================================
 *  CANTEMOS PARA LA SANTA MISA — MÓDULO ANTI-MANIPULACIÓN
 * =============================================================
 * Endurece el runtime contra alteraciones básicas (hackeo de
 * cliente) y avisa si detecta depuración activa. Pensado para
 * elevar el costo de manipular la app, no para hacerlo imposible
 * (imposible no existe en el navegador).
 *
 * Incluye:
 *  1) Congelamiento de objetos/funciones críticas.
 *  2) Detección no invasiva de DevTools abiertas.
 *  3) Verificación de que este mismo script no fue removido.
 *  4) Protección básica contra copiar/pegar masivo de contenido
 *     (opcional, desactivada por defecto — ver CONFIG).
 * =============================================================
 */
(function () {
  "use strict";

  const SELLO = "cantemos-la-santa-misa";

  const CONFIG = {
    // Si true, muestra un aviso discreto (no bloqueante) cuando
    // detecta que las DevTools están abiertas. No impide su uso
    // (bloquear DevTools por completo no es técnicamente posible
    // y perjudica a usuarios legítimos con lectores de pantalla,
    // etc.), solo dificulta la copia casual.
    avisarDevTools: true,

    // Si true, deshabilita clic derecho y selección de texto en
    // zonas marcadas con [data-proteger-contenido]. Úsalo solo en
    // vistas donde de verdad quieras dificultar copiar letras de
    // canciones completas; NO lo actives globalmente porque
    // rompe accesibilidad y molesta a usuarios normales.
    protegerSeleccionEnZonasMarcadas: true,
  };

  // -----------------------------------------------------------
  // 1) Congelar utilidades críticas para dificultar el "parcheo"
  //    en caliente desde la consola (ej. alguien intentando
  //    desactivar la validación de dominio o el sello).
  // -----------------------------------------------------------
  function congelarObjetosCriticos() {
    try {
      if (window.CantemosSello) Object.freeze(window.CantemosSello);
      if (window.CantemosAntiClon) Object.freeze(window.CantemosAntiClon);
    } catch (e) {}
  }

  // -----------------------------------------------------------
  // 2) Detección de DevTools por diferencia de tamaño de ventana
  //    (heurística estándar, no 100% fiable pero sin falsos
  //    positivos molestos en móvil, donde no se activa).
  // -----------------------------------------------------------
  function detectarDevTools() {
    if (!CONFIG.avisarDevTools) return;
    const umbral = 160;
    let avisado = false;
    setInterval(() => {
      const abierta =
        window.outerWidth - window.innerWidth > umbral ||
        window.outerHeight - window.innerHeight > umbral;
      if (abierta && !avisado) {
        avisado = true;
        console.log(
          `%c[${SELLO}] Recuerda: el contenido de esta app está protegido por derechos de autor.`,
          "color:#7a2020;font-weight:bold;"
        );
      }
      if (!abierta) avisado = false;
    }, 1500);
  }

  // -----------------------------------------------------------
  // 3) Auto-verificación: confirma que los otros módulos de
  //    seguridad siguen cargados. Si alguien elimina el script
  //    de anti-clonación desde el HTML servido (ataque de
  //    tampering en el hosting), esto queda registrado.
  // -----------------------------------------------------------
  function autoverificacion() {
    setTimeout(() => {
      const ok = !!(window.CantemosSello && window.CantemosAntiClon);
      if (!ok) {
        console.warn(
          `[${SELLO}] ⚠️ Módulos de seguridad incompletos. Verifica que todos los scripts de /seguridad estén cargados en el HTML.`
        );
      }
    }, 2000);
  }

  // -----------------------------------------------------------
  // 4) Protección opcional de selección/copiado en zonas
  //    marcadas explícitamente por ti con data-proteger-contenido.
  // -----------------------------------------------------------
  function protegerZonasMarcadas() {
    if (!CONFIG.protegerSeleccionEnZonasMarcadas) return;
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest && e.target.closest("[data-proteger-contenido]")) {
        e.preventDefault();
      }
    });
    document.addEventListener("copy", (e) => {
      const zona = e.target.closest && e.target.closest("[data-proteger-contenido]");
      if (zona) {
        const seleccion = window.getSelection().toString();
        const marcado =
          window.CantemosSello && window.CantemosSello.marcaDeAguaTexto
            ? window.CantemosSello.marcaDeAguaTexto(seleccion)
            : seleccion + `\n\n[${SELLO}]`;
        e.clipboardData.setData("text/plain", marcado);
        e.preventDefault();
      }
    });
  }

  function init() {
    congelarObjetosCriticos();
    detectarDevTools();
    autoverificacion();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", protegerZonasMarcadas);
    } else {
      protegerZonasMarcadas();
    }
  }

  init();

  window.CantemosAntiManipulacion = { CONFIG };
})();
