# Aviso de derechos de autor — "cantemos-la-santa-misa"

> ⚠️ Esto es una plantilla informativa, no asesoría legal. Para una protección legal firme (registro formal, actuar contra un clon específico, etc.) consulta con un abogado especializado en propiedad intelectual/derechos de autor en tu país.

## 1. Texto sugerido para incluir en la app (footer, pantalla "Acerca de", o README público)

```
© [AÑO] Gloria. Todos los derechos reservados.
"cantemos-la-santa-misa" es el nombre/sello distintivo de esta aplicación
y su contenido (código, diseño, compilación del cancionero).
Queda prohibida su reproducción, distribución, comunicación pública o
transformación total o parcial sin autorización expresa de la autora.
```

## 2. Qué protege automáticamente el derecho de autor (sin registrar nada)

En la mayoría de países (Convenio de Berna, casi 180 países firmantes) el derecho de autor nace automáticamente al crear la obra original — no necesitas registrarla para tener derechos. Esto cubre: el código fuente, los textos/arreglos originales que hayas escrito, el diseño de la interfaz y la selección/organización del cancionero (la "compilación").

**Lo que NO cubre el derecho de autor:** las letras de himnos/cantos que son de dominio público o de otros autores (la Iglesia, compositores litúrgicos, etc.) — de esas solo eres dueña de tu compilación y presentación, no de la letra original si no la escribiste tú.

## 3. Pasos recomendados para reforzar tu posición legal

1. **Guarda evidencia de fecha de creación**: historial de Git, capturas fechadas, correos, este mismo proyecto con fecha. Sirve como prueba si algún día necesitas demostrar que tu versión es anterior a un clon.
2. **Registro formal (opcional pero recomendado)**: en muchos países existe una oficina de derechos de autor donde puedes registrar la obra por un costo bajo (ej. Dirección Nacional de Derecho de Autor en varios países de LatAm, U.S. Copyright Office en EE.UU., etc.). Un registro formal facilita mucho actuar legalmente después.
3. **Términos de uso / licencia explícita**: publica un archivo `LICENSE` o `TERMINOS.md` indicando qué se permite (ej. "uso personal/parroquial permitido, prohibida la reventa o republicación como app propia").
4. **Marca/nombre**: si "Cantemos para la Santa Misa" se vuelve una marca reconocida, considera evaluar el registro de marca (nombre + logo) ante la oficina de marcas de tu país — esto es distinto al derecho de autor y protege el *nombre* frente a que otros lo usen para apps similares.

## 4. Si detectas un clon o plagio

1. Reúne evidencia: capturas de pantalla, URL del clon, fecha, comparación lado a lado con tu app (el sello técnico embebido en este paquete de seguridad ayuda aquí: busca `"cantemos-la-santa-misa"` en el código fuente del clon con "ver código fuente").
2. Si el clon está en una tienda de apps (Google Play / App Store), ambas tienen formularios de **reporte por infracción de derechos de autor / propiedad intelectual** — normalmente retiran la app infractora en días si la evidencia es clara.
3. Si está en la web, puedes enviar un **aviso DMCA** (funciona incluso fuera de EE.UU. porque casi todo hosting/CDN grande — GitHub, Cloudflare, Google, Amazon — respeta DMCA) al proveedor de hosting del clon, adjuntando la evidencia.
4. Guarda todo por escrito antes de contactar al infractor directamente, en caso de que el reclamo escale.

## 5. Sello técnico como evidencia

El módulo `01-sello-marca-agua.js` de este paquete incrusta `"cantemos-la-santa-misa"` junto a tu autoría en metadatos, comentarios del DOM y hashes de verificación. Si alguien copia el código sin eliminar cuidadosamente estas marcas (lo cual es fácil de pasar por alto), esa evidencia queda embebida en su propia copia — es un argumento adicional, no una prueba legal por sí sola.
