# Cabeceras HTTP de seguridad — "cantemos-la-santa-misa"

Estas cabeceras se configuran en tu hosting (no en JS del navegador) y protegen contra hackeo real: inyección de scripts ajenos, robo de clics, filtración de datos, carga de tu app dentro de un iframe ajeno para clonarla, etc.

## Cabeceras recomendadas

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Qué hace cada una:

- **Content-Security-Policy (CSP)**: evita que un atacante inyecte JavaScript ajeno en tu app (XSS). También `frame-ancestors 'self'` impide que alguien empotre tu app dentro de un iframe en otro sitio para clonarla o hacer "clickjacking".
- **X-Frame-Options**: refuerzo del punto anterior en navegadores más antiguos.
- **X-Content-Type-Options**: evita que el navegador "adivine" tipos de archivo, bloqueando algunos trucos de inyección.
- **Referrer-Policy**: evita filtrar URLs internas/tokens en el header Referer cuando alguien navega fuera de tu app.
- **Permissions-Policy**: desactiva APIs del navegador que no usas (cámara, micrófono, geolocalización), reduciendo superficie de ataque.
- **Strict-Transport-Security (HSTS)**: fuerza HTTPS siempre, evitando ataques de intermediario (man-in-the-middle) que degraden la conexión a HTTP.

## Cómo aplicarlas según tu hosting

### Netlify
Crea/edita `netlify.toml` en la raíz:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
```

### Vercel
Crea/edita `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    }
  ]
}
```

### Firebase Hosting
Edita `firebase.json`:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" },
          { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
        ]
      }
    ]
  }
}
```

### GitHub Pages
GitHub Pages no permite cabeceras personalizadas. Si usas GitHub Pages, considera migrar a Netlify, Vercel o Cloudflare Pages (gratuitos y sí lo permiten) para poder aplicar CSP/HSTS reales.

### Apache (.htaccess) / servidor propio
```apache
<IfModule mod_headers.c>
  Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
  Header set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
</IfModule>
```

## Nota sobre CSP y `unsafe-inline`

Si tu app usa estilos o scripts inline (`<script>...</script>` directo en el HTML), el CSP de arriba los bloqueará salvo que ajustes `style-src`/`script-src`. Lo ideal es mover todo JS a archivos `.js` externos (mejor también para la ofuscación del paso 06) y usar hojas de estilo externas. Si no puedes evitar inline scripts, usa un `nonce` o `hash` en vez de `'unsafe-inline'` — es más seguro.

## Subresource Integrity (SRI) para librerías externas

Si cargas librerías desde un CDN (ej. Chart.js, alguna fuente), añade el atributo `integrity`:

```html
<script src="https://cdn.ejemplo.com/libreria.js"
        integrity="sha384-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
        crossorigin="anonymous"></script>
```

Esto evita que, si el CDN es hackeado, se inyecte código malicioso en tu app sin que te enteres. Puedes generar el hash `integrity` en https://www.srihash.org/ o con `openssl dgst -sha384 -binary archivo.js | openssl base64 -A`.
