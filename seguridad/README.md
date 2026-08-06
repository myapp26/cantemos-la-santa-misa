# Capa de seguridad — "cantemos-la-santa-misa"

Paquete de protección para tu PWA, pensado para funcionar igual en:
- **App instalada en el celular** (PWA agregada a pantalla de inicio / TWA).
- **Versión web en cualquier navegador**.

Ambas corren el mismo código HTML/JS/service-worker, así que esta misma capa cubre las dos automáticamente — no necesitas nada distinto para "la versión móvil".

## ⚠️ Lectura obligatoria antes de integrar: qué protege esto y qué NO

Una app web/PWA se ejecuta 100% en el dispositivo del usuario. Eso significa que **cualquiera puede ver tu código fuente** con "Ver código fuente" o las herramientas de desarrollador — ninguna técnica (ni la de esta capa, ni ninguna en el mercado) lo evita al 100%. Esto es así para todas las apps web del mundo, no es un límite de esta implementación.

Lo que **sí** logra este paquete:
- Sube el costo/esfuerzo de copiar tu app de "copiar y pegar" a "requiere trabajo técnico real" (ofuscación, control de flujo, anti-debug).
- Deja **evidencia de autoría verificable** incrustada en cualquier copia (el sello), útil para reclamos de plagio ante tiendas de apps, hosting o legalmente.
- Detecta y avisa cuando la app corre en un **dominio no autorizado** (clon publicado en otro sitio).
- Cierra vulnerabilidades reales de hackeo web: inyección de scripts (XSS), clickjacking, envenenamiento de caché del service worker, MITM por HTTP sin cifrar.
- Protege mejor cualquier dato sensible si en el futuro agregas un backend/API (con las recomendaciones de la sección 6).

Lo que **no** puede lograr ninguna app web (ni esta ni otra):
- Impedir que alguien vea el código fuente.
- Impedir 100% que alguien con suficiente conocimiento técnico elimine las validaciones.
- Sustituir un registro legal de derechos de autor si necesitas actuar legalmente contra un clon (ver `07-aviso-legal-derechos.md`).

## Contenido del paquete

| Archivo | Qué hace |
|---|---|
| `01-sello-marca-agua.js` | Incrusta el sello `cantemos-la-santa-misa` en meta tags, DOM, consola y firma datos exportados. |
| `02-anti-clonacion.js` | Bloquea/avisa si la app corre en un dominio no autorizado; verifica integridad de archivos críticos. |
| `03-anti-manipulacion.js` | Congela objetos críticos, detecta DevTools, protege zonas de contenido marcadas. |
| `04-service-worker-integridad.js` | Fragmentos para tu `sw.js`: caché con sello, evita envenenamiento de caché. |
| `05-cabeceras-http.md` | Cabeceras de seguridad (CSP, HSTS, etc.) para Netlify/Vercel/Firebase/Apache. |
| `06-build/` | Configuración de ofuscación para el build de producción. |
| `07-aviso-legal-derechos.md` | Plantilla de aviso de copyright y pasos si detectas un plagio. |

## Cómo integrar (orden recomendado)

### 1. Copia los scripts a tu proyecto
Copia `01-`, `02-` y `03-` a la carpeta pública de tu app (ej. `/public/seguridad/` o similar según tu framework).

### 2. Cárgalos en tu HTML principal
En tu `index.html`, justo antes de cerrar `</body>` (o en el `<head>` si prefieres que corran lo antes posible):

```html
<script src="/seguridad/01-sello-marca-agua.js"></script>
<script src="/seguridad/02-anti-clonacion.js"></script>
<script src="/seguridad/03-anti-manipulacion.js"></script>
```

### 3. Configura tus dominios reales
Abre `02-anti-clonacion.js` y edita `DOMINIOS_AUTORIZADOS` con tu(s) dominio(s) real(es) antes de publicar. Sin esto, el domain-lock no bloqueará nada (por diseño, para no romper tu app mientras aún no lo configuras).

### 4. Integra el service worker
Abre `04-service-worker-integridad.js` y copia las secciones marcadas `COPIAR A TU sw.js` dentro de tu service worker real, adaptando la lista de archivos a precachear.

### 5. Configura cabeceras HTTP
Sigue `05-cabeceras-http.md` según dónde publiques (Netlify, Vercel, Firebase, Apache, etc.).

### 6. Ofusca antes de publicar
```bash
cd 06-build
npm install
npm run verificar   # comprueba que los scripts no tengan errores de sintaxis
npm run ofuscar      # genera versión ofuscada en 06-build/dist
```
Publica los archivos de `06-build/dist` (junto al resto de tu build) en vez de los originales sin ofuscar.

### 7. Sello legal
Añade el texto de `07-aviso-legal-derechos.md` (sección 1) en el footer o pantalla "Acerca de" de tu app.

## Si tu app ya tiene backend/API (para el futuro)

Si en algún momento agregas un servidor propio (ej. para sincronizar cancioneros, cuentas de usuario, etc.), añade estas capas ahí — son más efectivas que cualquier protección en el navegador:

- Autenticación por API key o token, nunca datos sensibles solo en el cliente.
- Rate limiting (ej. Cloudflare, o middleware del framework) para evitar scraping masivo de tu cancionero.
- Validar `Origin`/`Referer` en el servidor, no solo confiar en el chequeo de dominio del cliente (ese se puede desactivar editando el JS).
- CORS restringido a tus dominios.

## Mantenimiento

- Sube `CACHE_VERSION` en `04-service-worker-integridad.js` en cada release para forzar actualización de caché.
- Vuelve a ejecutar `npm run ofuscar` en cada build de producción — automatízalo en tu pipeline de CI/CD si tienes uno.
- Revisa cada tanto que `DOMINIOS_AUTORIZADOS` siga reflejando dónde publicas realmente la app.
