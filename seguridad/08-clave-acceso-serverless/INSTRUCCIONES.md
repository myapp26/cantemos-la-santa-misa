# Migrar la clave fija a validación serverless (Netlify Functions)

Esto saca tu clave de acceso del JavaScript del navegador (donde cualquiera puede verla con "ver código fuente") y la mueve a una función que corre solo en el servidor de Netlify.

## 1. Genera un `TOKEN_SECRET`

Es una cadena aleatoria distinta a tu clave de acceso, usada solo para firmar las sesiones. Genérala una vez y guárdala en un lugar seguro (no en el código):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado (una cadena larga tipo `a3f9e1...`).

## 2. Configura las variables de entorno en Netlify

En el panel de Netlify de tu sitio `cantemos-la-santa-misa`:

**Site configuration → Environment variables → Add a variable**

| Nombre | Valor |
|---|---|
| `CLAVE_ACCESO` | tu clave de acceso real (la misma que usan tus usuarios hoy) |
| `TOKEN_SECRET` | la cadena generada en el paso 1 |

⚠️ Nunca escribas estos valores en tu código ni los subas a git — solo viven en el panel de Netlify.

## 3. Ubica la carpeta de funciones en la raíz de tu proyecto

Copia la carpeta `netlify/functions/` de este paquete a la **raíz de tu proyecto real** (donde está tu `index.html`), no dentro de esta carpeta `seguridad/`. Debe quedar así:

```
tu-proyecto/
├── index.html
├── netlify.toml
└── netlify/
    └── functions/
        ├── verificar-clave.js
        └── verificar-token.js
```

## 4. Declara la carpeta de funciones en `netlify.toml`

Si ya tienes un `netlify.toml` (por ejemplo, con las cabeceras de seguridad de `05-cabeceras-http.md`), añade la sección `[build]` con `functions`:

```toml
[build]
  functions = "netlify/functions"

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
```

`connect-src 'self'` ya permite llamar a `/.netlify/functions/...` porque cuenta como tu propio origen — no necesitas agregar nada extra al CSP para esto.

## 5. Reemplaza la clave fija en tu app

1. Copia `cliente-clave-acceso.js` a tu proyecto (ej. junto a los otros scripts de `seguridad/`) y cárgalo en tu `index.html`:
   ```html
   <script src="/seguridad/cliente-clave-acceso.js"></script>
   ```
2. Busca en tu código actual dónde comparas la clave escrita por el usuario contra la clave fija (algo como `if (claveIngresada === "tuClave")`) y **bórralo por completo** — ya no debe existir ninguna clave escrita en el JS.
3. Reemplázalo por:
   ```js
   // Al enviar el formulario de acceso:
   const ok = await CantemosAcceso.iniciarSesion(claveIngresada);
   if (ok) {
     mostrarApp();
   } else {
     mostrarError("Clave incorrecta");
   }
   ```
4. Al cargar la app, antes de mostrar el formulario de clave, pregunta si ya hay sesión activa para no pedirla de nuevo en ese mismo dispositivo:
   ```js
   const activa = await CantemosAcceso.sesionActiva();
   if (activa) {
     mostrarApp();
   } else {
     mostrarFormularioClave();
   }
   ```

## 6. Prueba antes de publicar

Con [Netlify CLI](https://docs.netlify.com/cli/get-started/) instalado (`npm install -g netlify-cli`):

```bash
netlify dev
```

Esto corre tu sitio Y las funciones localmente en `http://localhost:8888`, simulando el entorno real de Netlify (necesario porque `/.netlify/functions/...` no funciona con un simple servidor estático).

## 7. Publica

Haz commit y push como siempre (o `netlify deploy --prod` si despliegas manual). Confirma que las variables de entorno estén configuradas en el sitio de producción, no solo en tu máquina.

## Notas importantes

- **Sigue siendo un solo "portón" compartido**, no cuentas individuales por usuario — es el mismo modelo que ya tenías (una clave, muchos usuarios), solo que ahora la clave no es visible en el código.
- **La fricción de 700ms en `verificar-clave.js` es una defensa básica**, no un límite de intentos real. Si quieres algo más fuerte (bloqueo tras N intentos fallidos por IP), se puede agregar con Netlify Blobs o un servicio como Upstash — dímelo si lo quieres y lo preparo aparte, para no complicar esta primera migración.
- Si cambias la clave en el futuro, solo actualiza la variable `CLAVE_ACCESO` en Netlify — no requiere tocar código ni volver a desplegar el sitio.
