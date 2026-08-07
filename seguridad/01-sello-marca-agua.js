/**
 * =============================================================
 *  CANTEMOS PARA LA SANTA MISA — MÓDULO DE SELLO / MARCA DE AGUA
 * =============================================================
 * Sello propio: "cantemos-la-santa-misa"
 * Autor: Gloria (todos los derechos reservados)
 *
 * QUÉ HACE:
 *  1) Incrusta el sello en varios lugares del app (meta tags,
 *     DOM oculto, consola, caché) para poder DEMOSTRAR autoría
 *     si alguien clona o copia la app.
 *  2) Firma cualquier dato exportado (JSON, texto, PDF) con el
 *     sello, para que las copias "se delaten" solas.
 *
 * Esto NO evita que alguien copie el código (eso es imposible al
 * 100% en la web), pero deja evidencia de autoría verificable en
 * cada copia, útil para reclamos de plagio (DMCA, denuncias en
 * tiendas de apps, etc.).
 *
 * Cárgalo lo antes posible en tu HTML principal:
 *   <script src="/seguridad/01-sello-marca-agua.js"></script>
 * =============================================================
 */
(function () {
  "use strict";

  const SELLO = "cantemos-la-santa-misa";
  const AUTOR = "Gloria — todos los derechos reservados";
  const AÑO = new Date().getFullYear();
  const HASH_SELLO = simpleHash(SELLO + "|" + AUTOR);

  // ---------------------------------------------------------
  // 1. Meta tag oculto con el sello (visible en "ver código
  //    fuente", sirve como prueba de autoría fechable).
  // ---------------------------------------------------------
  function inyectarMeta() {
    if (document.querySelector('meta[name="app-sello"]')) return;
    const meta = document.createElement("meta");
    meta.setAttribute("name", "app-sello");
    meta.setAttribute(
      "content",
      `${SELLO} | © ${AÑO} ${AUTOR} | hash:${HASH_SELLO}`
    );
    document.head.appendChild(meta);

    const meta2 = document.createElement("meta");
    meta2.setAttribute("name", "copyright");
    meta2.setAttribute("content", `© ${AÑO} ${AUTOR}`);
    document.head.appendChild(meta2);
  }

  // ---------------------------------------------------------
  // 2. Atributo oculto en <html> + comentario en el DOM.
  //    Si alguien clona el HTML tal cual, el sello viaja con él.
  // ---------------------------------------------------------
  function inyectarDOM() {
    document.documentElement.setAttribute("data-sello", SELLO);
    document.documentElement.setAttribute("data-sello-hash", HASH_SELLO);
    const comentario = document.createComment(
      ` SELLO: ${SELLO} — Propiedad de ${AUTOR} — Prohibida su reproducción o redistribución sin autorización — hash:${HASH_SELLO} `
    );
    document.body ? document.body.prepend(comentario) : document.addEventListener(
      "DOMContentLoaded",
      () => document.body.prepend(comentario)
    );
  }

  // ---------------------------------------------------------
  // 3. Banner de consola: cualquier copia mostrará quién es el
  //    autor real cuando alguien abra las herramientas de dev.
  // ---------------------------------------------------------
  function bannerConsola() {
    const estilo = "color:#7a2020; font-weight:bold; font-size:14px;";
    console.log("%c" + SELLO, estilo);
    console.log(
      `%c© ${AÑO} ${AUTOR}\nEsta aplicación está protegida. Cualquier copia, clon o redistribución no autorizada será reportada.\nHash de verificación: ${HASH_SELLO}`,
      "color:#7a2020;"
    );
  }

  // ---------------------------------------------------------
  // 4. Firma de datos exportados: úsalo para "watermarkear"
  //    cualquier JSON, texto o PDF que tu app genere/exporte
  //    (ej. exportar un cancionero, compartir una canción, etc).
  // ---------------------------------------------------------
  function firmarDatos(datos) {
    const payload = typeof datos === "string" ? datos : JSON.stringify(datos);
    const firma = {
      sello: SELLO,
      autor: AUTOR,
      generado: new Date().toISOString(),
      hash: simpleHash(payload + SELLO),
    };
    if (typeof datos === "object" && datos !== null && !Array.isArray(datos)) {
      return Object.assign({}, datos, { _sello: firma });
    }
    return { contenido: datos, _sello: firma };
  }

  // Marca de agua de texto invisible (caracteres de ancho cero)
  // para insertar en letras de canciones exportadas/compartidas.
  // No afecta la lectura visual, pero permite rastrear copias
  // pegadas desde tu app en otros sitios.
  function marcaDeAguaTexto(texto) {
    const ZW = ["​", "‌", "‍"]; // espacios de ancho cero
    const codigo = SELLO.split("").map((c) => c.charCodeAt(0) % ZW.length);
    const marca = codigo.map((i) => ZW[i]).join("");
    return texto + marca;
  }

  function detectarMarcaDeAgua(texto) {
    return /[​‌‍]/.test(texto);
  }

  // Hash simple (no criptográfico) solo para huella de verificación,
  // no para seguridad crítica.
  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(16);
  }

  // ---------------------------------------------------------
  // Inicialización
  // ---------------------------------------------------------
  function init() {
    inyectarMeta();
    inyectarDOM();
    bannerConsola();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exponer utilidades para que el resto de la app las use
  // (ej. al exportar/compartir contenido).
  window.CantemosSello = {
    SELLO,
    AUTOR,
    HASH_SELLO,
    firmarDatos,
    marcaDeAguaTexto,
    detectarMarcaDeAgua,
    simpleHash,
  };
})();
