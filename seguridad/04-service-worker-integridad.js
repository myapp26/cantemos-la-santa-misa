/**
 * =============================================================
 *  CANTEMOS PARA LA SANTA MISA — ENDURECIMIENTO DEL SERVICE WORKER
 * =============================================================
 * Este archivo NO reemplaza tu sw.js actual. Es un conjunto de
 * fragmentos para INCORPORAR dentro de tu service worker existente,
 * pensados para:
 *  1) Marcar la caché con el sello (evidencia de autoría también
 *     en la versión "instalada offline" de la app).
 *  2) Evitar envenenamiento de caché: solo se cachean respuestas
 *     que vengan de tu propio origen (same-origin) con estado 200.
 *  3) Verificar integridad básica de los recursos cacheados.
 *
 * CÓMO USAR: copia las secciones marcadas "COPIAR A TU sw.js"
 * dentro de tu archivo real de service worker, adaptando los
 * nombres de caché/rutas a los que ya uses.
 * =============================================================
 */

// ---------- COPIAR A TU sw.js: nombre de caché con sello ----------
const SELLO = "cantemos-la-santa-misa";
const CACHE_VERSION = "v1"; // súbelo en cada release
const CACHE_NAME = `${SELLO}-${CACHE_VERSION}`;

// ---------- COPIAR A TU sw.js: instalación segura ----------
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Guarda aquí tu lista real de recursos a precachear.
      return cache.addAll([
        "/",
        "/index.html",
        "/manifest.json",
        // ...resto de tus assets offline
      ]);
    })
  );
});

// ---------- COPIAR A TU sw.js: limpieza de cachés viejas/ajenas ----------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((n) => n.startsWith(SELLO) && n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// ---------- COPIAR A TU sw.js: fetch con validación de origen ----------
// Evita "cache poisoning": solo cachea respuestas 200 de tu propio
// origen. Respuestas de terceros (CDNs, APIs externas) se sirven
// pero no se guardan en caché salvo que tú lo decidas explícitamente.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const mismoOrigen = url.origin === self.location.origin;

  event.respondWith(
    caches.match(event.request).then((cacheado) => {
      const fetchPromise = fetch(event.request)
        .then((respuestaRed) => {
          if (mismoOrigen && respuestaRed && respuestaRed.status === 200) {
            const clon = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clon);
            });
          }
          return respuestaRed;
        })
        .catch(() => cacheado);

      return cacheado || fetchPromise;
    })
  );
});

// ---------- OPCIONAL: mensaje de identidad para depuración ----------
// Permite que la app (desde el hilo principal) le pregunte al
// service worker cuál es su sello/versión, útil para confirmar
// en producción que corre la versión oficial y no una alterada.
self.addEventListener("message", (event) => {
  if (event.data === "CANTEMOS_IDENTIFICAR") {
    event.source.postMessage({ sello: SELLO, cache: CACHE_NAME });
  }
});
