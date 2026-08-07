// Service worker — "siempre busca la última versión" para contenido que cambia.
// No necesitas tocar números de versión al actualizar el repertorio.
const SELLO = "cantemos-la-santa-misa";
const CACHE = SELLO;

// Recursos que NO cambian: se sirven desde caché (rápido y offline).
const STATIC = ["./icon-192.png","./icon-512.png","./icon-180.png","./manifest.json"];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys()
      .then(nombres=>Promise.all(nombres.filter(n=>n!==CACHE).map(n=>caches.delete(n))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", e=>{
  const url = new URL(e.request.url);
  const path = url.pathname;
  const mismoOrigen = url.origin === self.location.origin;
  // Archivos que cambian al publicar: index.html, canciones.js y la raíz "/".
  const esDinamico = path.endsWith("/") || path.endsWith("index.html") || path.endsWith("canciones.js");

  if(esDinamico){
    // NETWORK-FIRST: intenta la red; si hay internet, trae lo más nuevo y lo guarda.
    // Si no hay internet, usa la última copia guardada.
    e.respondWith(
      fetch(e.request).then(resp=>{
        if(mismoOrigen && resp.status===200){
          const copy = resp.clone();
          caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
        }
        return resp;
      }).catch(()=> caches.match(e.request).then(r=> r || caches.match("./index.html")))
    );
  } else if(mismoOrigen){
    // CACHE-FIRST para lo estático propio (íconos, manifest).
    e.respondWith(
      caches.match(e.request).then(r=> r || fetch(e.request).then(resp=>{
        if(resp.status===200){
          const copy = resp.clone();
          caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
        }
        return resp;
      }))
    );
  }
  // Pedidos a otros orígenes (ej. validate-key en Supabase) se dejan pasar
  // directo a la red sin interceptar ni cachear — evita envenenamiento de caché.
});

// Permite que la app pregunte al service worker cuál es su sello/versión.
self.addEventListener("message", e=>{
  if(e.data === "CANTEMOS_IDENTIFICAR"){
    e.source.postMessage({ sello: SELLO, cache: CACHE });
  }
});
