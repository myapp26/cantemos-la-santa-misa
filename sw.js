// Service worker — "siempre busca la última versión" para contenido que cambia.
// No necesitas tocar números de versión al actualizar el repertorio.
const CACHE = "cantemos";

// Recursos que NO cambian: se sirven desde caché (rápido y offline).
const STATIC = ["./icon-192.png","./icon-512.png","./icon-180.png","./manifest.json"];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", e=>{
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", e=>{
  const url = new URL(e.request.url);
  const path = url.pathname;
  // Archivos que cambian al publicar: index.html, canciones.js y la raíz "/".
  const esDinamico = path.endsWith("/") || path.endsWith("index.html") || path.endsWith("canciones.js");

  if(esDinamico){
    // NETWORK-FIRST: intenta la red; si hay internet, trae lo más nuevo y lo guarda.
    // Si no hay internet, usa la última copia guardada.
    e.respondWith(
      fetch(e.request).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
        return resp;
      }).catch(()=> caches.match(e.request).then(r=> r || caches.match("./index.html")))
    );
  } else {
    // CACHE-FIRST para lo estático (íconos, manifest).
    e.respondWith(
      caches.match(e.request).then(r=> r || fetch(e.request).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
        return resp;
      }))
    );
  }
});
