# Contexto para Claude Code — Capa de seguridad "cantemos-la-santa-misa"

Este archivo resume el trabajo ya hecho en esta carpeta para que cualquier sesión futura de Claude (Code o Cowork) tenga contexto completo sin tener que releer el chat original.

## Qué es esto

PWA litúrgica **"Cantemos para la Santa Misa"** (cancionero digital, funciona offline, se comparte con clave de acceso a distintos usuarios/dispositivos). Publicada en Netlify: `https://cantemos-la-santa-misa.netlify.app/`.

Esta carpeta (`seguridad/`) contiene una **capa de seguridad independiente** creada para: dificultar el plagio/clonación de la app, dejar evidencia de autoría (sello propio), y endurecer la app contra hackeo básico. Sirve igual para la versión instalada en celular (PWA) y la versión web — es el mismo código en ambos casos.

**✅ Actualización 2026-08-06 — ya integrado en el proyecto real** (sesión "seguro de la app"). Ver estado detallado más abajo. Un punto importante que se descubrió al integrar: el paquete `08-clave-acceso-serverless/` se diseñó sin ver el código real, asumiendo "una clave fija visible en el JS". Eso ya no es así — la app real usa desde antes un sistema de claves por dispositivo validadas server-side vía Supabase (`supabase/functions/validate-key`, `scripts/keys.js`, ver `../ADMIN.md`), que es superior a lo que ese paquete construiría. Por eso el punto 5 de más abajo (migración de login) se dejó **explícitamente sin aplicar** — no reemplazar el sistema Supabase por el de Netlify Functions de clave única, sería un downgrade.

## Sello propio

`cantemos-la-santa-misa` — identifica la autoría (Gloria, todos los derechos reservados) y aparece incrustado en meta tags, DOM, consola, tokens y nombres de caché.

## Inventario de archivos (en orden de creación)

| Archivo | Estado | Qué hace |
|---|---|---|
| `01-sello-marca-agua.js` | Listo, sin integrar en la app real | Sello en meta tags/DOM/consola, firma de datos exportados, marca de agua invisible en texto. |
| `02-anti-clonacion.js` | Listo, **dominio ya configurado** | Domain-lock: solo permite `localhost`, `127.0.0.1` y `cantemos-la-santa-misa.netlify.app`. Verificación de integridad de archivos (lista `ARCHIVOS_CRITICOS` aún vacía — pendiente de completar con los archivos reales del proyecto). |
| `03-anti-manipulacion.js` | Listo, sin integrar | Congela objetos críticos, detecta DevTools (aviso no bloqueante), protección opcional de copiar/pegar en zonas marcadas con `data-proteger-contenido`. |
| `04-service-worker-integridad.js` | Fragmentos para copiar a `sw.js` real, sin integrar | Nombre de caché con sello, evita envenenamiento de caché (solo cachea same-origin 200 OK), limpia cachés viejas. |
| `05-cabeceras-http.md` | Documentación, sin aplicar aún | Cabeceras CSP/HSTS/etc. con ejemplos de `netlify.toml` listos para copiar. |
| `06-build/` | Integrado como build step de Netlify | `package.json` + `obfuscator.config.json` (javascript-obfuscator). Ofusca `01-03` en cada deploy vía `[build] command` en `../netlify.toml`. |
| `07-aviso-legal-derechos.md` | Documentación | Plantilla de aviso de copyright + pasos si se detecta un clon/plagio. |
| `08-clave-acceso-serverless/` | Listo, sin integrar | Migra la clave de acceso de "fija en el JS" (insegura, visible en código fuente) a una Netlify Function que la valida server-side con `CLAUDE_ACCESO`/`TOKEN_SECRET` como variables de entorno, y emite un token firmado (HMAC, 30 días) para no pedir la clave en cada visita. Incluye `verificar-clave.js`, `verificar-token.js`, `cliente-clave-acceso.js` e `INSTRUCCIONES.md` con la migración paso a paso. |
| `README.md` | Guía maestra | Explica límites reales de la protección (nada en la web es 100% infranqueable), orden de integración recomendado, y qué hacer si más adelante hay backend/API propio. |

## Decisiones y contexto acordado con la usuaria (Gloria)

- El acceso a la app hoy es **una sola clave compartida** para todos los usuarios (no cuentas individuales) — el modelo de "portón único" se mantiene, solo se está moviendo la validación de esa clave del cliente al servidor.
- La clave hoy está **hardcodeada en el JS del cliente** (visible en código fuente) — es la vulnerabilidad más urgente identificada, por eso se creó `08-clave-acceso-serverless/`.
- Un solo dominio de distribución: `cantemos-la-santa-misa.netlify.app` (ya reflejado en `02-anti-clonacion.js`).
- Se decidió NO sobre-diseñar (ej. no se implementó límite de intentos por IP con Netlify Blobs todavía — quedó como mejora opcional futura si se pide).

## Estado de integración (actualizado 2026-08-06)

1. ✅ Repositorio real conectado — el proyecto principal está en la raíz de este repo (`../index.html`, `../sw.js`, etc).
2. ✅ `01`, `02`, `03` integrados: `<script>` agregados antes de `</body>` en `../index.html`, apuntando a `/seguridad/01-...js` etc (se sirven directo desde ahí, no hizo falta copiarlos porque `seguridad/` ya está en la raíz publicada).
3. ✅ Fragmentos de `04-service-worker-integridad.js` integrados en `../sw.js`: nombre de caché con el sello, verificación same-origin + status 200 antes de cachear (evita cache poisoning, incluye el caso de la llamada cross-origin a Supabase), limpieza de cachés viejas al activar, listener `CANTEMOS_IDENTIFICAR`. Se mantuvo a propósito la estrategia network-first para `index.html`/`canciones.js`/`/` que ya tenía el service worker (para no tener que versionar la caché en cada release) — no se copió el patrón `CACHE_VERSION` del fragmento original porque hubiera revertido ese diseño.
4. ✅ Cabeceras de `05-cabeceras-http.md` aplicadas en `../netlify.toml`, **adaptadas a la app real**:
   - `script-src` necesita `'unsafe-inline'` porque toda la app usa un `<script>` inline grande y decenas de atributos `onclick=` en el HTML (no hay build step que separe JS externo). Sin eso, el CSP tal cual venía en el paquete habría roto la app entera.
   - `connect-src` incluye `https://zhxtoublmvrghmnpwxoj.supabase.co` porque si no, el CSP bloquea la llamada `fetch` a `validate-key` (el login dejaría de funcionar).
   - Se agregaron redirects 404 para `/seguridad/*.md`, `/seguridad/06-build/*`, `/seguridad/08-clave-acceso-serverless/*` y `/seguridad/04-service-worker-integridad.js` — son documentación/paquete interno, no hace falta que queden públicos solo por vivir en la carpeta servida.
   - **No** se agregó `[build] functions = "netlify/functions"` porque no se migró el login (ver punto 5).
5. ⛔ **Omitido a propósito**: migración de login a `08-clave-acceso-serverless/` (Netlify Functions con `CLAVE_ACCESO`/`TOKEN_SECRET`). La app real ya tiene un sistema mejor (claves por dispositivo vía Supabase, ver arriba). El único "password fijo" que queda en el código es el del modo admin local del editor de canciones (`doLogin()` en `index.html`), que es una protección de UI local (no hay secreto de servidor que proteger ahí) y no es el caso de uso que ese paquete resuelve — se dejó como está.
6. ⏳ Pendiente: completar `ARCHIVOS_CRITICOS` y `HASHES_ESPERADOS` en `02-anti-clonacion.js` una vez se sepa qué archivos del build final se quieren verificar por integridad (hoy la lista está vacía, la verificación no hace nada todavía).
7. ✅ Resuelto 2026-08-06 en rama `seguridad-ofuscacion` (partiendo de `main` ya con #6/#8/#9 mergeados): la ofuscación quedó integrada como build step de Netlify, no como paso manual.
   - Alcance: solo `seguridad/01-03` (sello, anti-clonación, anti-manipulación). `canciones.js` e `index.html` quedan sin ofuscar a propósito — ofuscarlos rompería los `onclick=` globales del HTML y, al cambiar el contenido servido en cada build, invalidaría los hashes de `ARCHIVOS_CRITICOS` cada vez.
   - `netlify.toml` ahora tiene `[build] command` que corre `cd seguridad/06-build && npm install && npm run ofuscar && cp dist/01... ../01... (x3)`. El código fuente legible queda en git; Netlify sobreescribe los 3 archivos servidos con la versión ofuscada solo durante el build, en el checkout efímero.
   - Bug encontrado y arreglado en `seguridad/06-build/package.json`: el script original ofuscaba todo `../` (=`seguridad/`) con `--exclude "**/06-build/**"`, pero ese glob no matchea en Windows (usa `\`) y el CLI terminaba recorriendo `06-build/node_modules` completo hasta crashear con un archivo no-JS. Se cambió a apuntar los 3 archivos explícitos (`../01-...js`, `../02-...js`, `../03-...js`) uno por uno — más robusto, no depende de excludes, no puede volver a agarrar `node_modules` por accidente aunque se agreguen archivos nuevos a `seguridad/`.
   - **Bug de producción encontrado de paso (ya arreglado, no relacionado con la ofuscación)**: el hash de `/index.html` en `HASHES_ESPERADOS` (agregado en #6) había quedado desactualizado desde el commit del footer de aviso legal (#8, posterior a cuando se calculó el hash) — cualquier usuario real venía viendo un falso "integridad alterada" en consola desde el merge del PR #1. Corregido recalculando el hash desde `git show HEAD:index.html` ya con el footer incluido. **Lección para el futuro**: cada vez que cambie `index.html`, `sw.js`, `canciones.js` o `manifest.json`, hay que recalcular su entrada en `HASHES_ESPERADOS` en el mismo commit — si no, se genera este mismo falso positivo silenciosamente.
   - Validado localmente: se corrió el build command completo (`npm install` + `npm run ofuscar` + `cp`) sobre una copia limpia del repo (vía `git show HEAD:archivo`, no el checkout de Windows que convierte a CRLF y falsea los hashes), sirviendo con un server HTTP local. Consola sin warnings de dominio ni de integridad, sello (`window.CantemosSello`) y demás globals cross-script funcionando igual que sin ofuscar.
8. ✅ Resuelto 2026-08-06: texto de `07-aviso-legal-derechos.md` (sección 1) agregado como `<footer class="app-footer">` en `../index.html`, justo debajo de `<main id="index">` (fuera del contenedor que se re-renderiza dinámicamente, así que no se pierde al filtrar/ordenar canciones). Estilo discreto acorde al resto de la app (`.app-footer` en el `<style>`).
9. ✅ Verificado 2026-08-06 en el Deploy Preview real del PR #1 (`deploy-preview-1--cantemos-la-santa-misa.netlify.app`, con la extensión de Chrome): **cero errores de CSP en consola** (scripts, estilos, fetch a Supabase) durante la carga y un intento de login. El `connect-src` del `netlify.toml` permite correctamente el dominio de Supabase; el preflight OPTIONS a `validate-key` pasa sin bloqueo de CSP.
   - Detalle colateral encontrado y ya resuelto: `02-anti-clonacion.js` bloqueaba el propio Deploy Preview (dominio `deploy-preview-1--...` no estaba en `DOMINIOS_AUTORIZADOS`). Se agregó aceptación por sufijo exacto `--cantemos-la-santa-misa.netlify.app` en `dominioAutorizado()` (sin abrir la puerta a otros sitios de Netlify) — commit `fb36a57` en `seguridad-csp-pendientes`.
   - **Salvedad original (ya resuelta, ver 2026-08-07 más abajo)**: en ese momento no se pudo verificar el flujo de login completo en el Deploy Preview porque `validate-key` respondía `Access-Control-Allow-Origin` fijo a producción, rechazando por CORS cualquier Origin de preview.

10. ✅ Resuelto 2026-08-07 (rama `fix-cors-validate-key-previews`, commit `df3bbbb`): `supabase/functions/validate-key/index.ts` ahora acepta por CORS, además del origin exacto de producción, cualquier Origin `https://` cuyo host termine en `--cantemos-la-santa-misa.netlify.app` (mismo criterio de sufijo que el domain-lock del cliente en `02-anti-clonacion.js`), usando la Web `URL` API para evitar suplantación por subdominio/path. Verificado con 11 casos unitarios (`deno lint` + tabla de casos borde: producción, preview, branch deploy, http en vez de https, dominio ajeno, suffix en el path, suffix-spoofing con subdominio, origin null/vacío/malformado) y con `curl` directo contra la función ya desplegada (Origin de deploy preview → ACAO correcto; Origin ajeno → sigue cayendo a producción, no se refleja). El login en Deploy Previews ya funciona de punta a punta.
    - Nota de proceso: `supabase/functions/validate-key/index.ts` tenía además, sin commitear, un cambio no relacionado (bypass de `desktop_blocked` para claves `is_admin`, ver `scripts/keys.js` y `supabase/migrations/0002_admin_keys.sql`). Se separó con cuidado antes de commitear/desplegar CORS: se aisló el archivo a la versión limpia de `main` + solo el fix de CORS para el commit y el deploy, y se restauró el bypass de admin como cambio local sin commitear después. Ese bypass de admin sigue pendiente de revisión/commit aparte.

Sintaxis verificada con `node --check` en `sw.js` y los `.js` de este paquete: todo OK. Sello `cantemos-la-santa-misa` confirmado presente en `sw.js` y en `01`, `02`, `03`.

## Cómo verificar que todo sigue coherente

```bash
# Sintaxis de todos los .js de este paquete
find . -name "*.js" -not -path "*/node_modules/*" -exec node --check {} \; -exec echo OK \;

# Confirmar que el sello aparece en todos los archivos relevantes
grep -rl "cantemos-la-santa-misa" .
```
