# Claves de acceso — guía rápida

La app pide una clave de activación la primera vez que se abre en un celular.
Esa clave queda atada a ese dispositivo: si alguien comparte el link o la
clave, en otro celular (o en una compu) va a ser rechazada.

## Generar una clave nueva

```
cd scripts
npm install        # solo la primera vez
node keys.js generate --note "Parroquia San José"
```

Esto imprime la clave (ej. `CSM-7F3K-9QRT-2LXP`) y un link listo para mandar:

```
https://cantemos-la-santa-misa.netlify.app/?key=CSM-7F3K-9QRT-2LXP
```

## Cómo compartirla

Mandale al usuario el link. **Recomendale que lo abra directamente en su
navegador normal (Chrome/Safari), no adentro de WhatsApp o Instagram**, y que
después de activarla instale la app a la pantalla de inicio (botón "Instalar
app" ya existente). Si activa la clave desde el navegador in-app y después
abre la app instalada, puede que el sistema los trate como "dos dispositivos"
distintos porque tienen almacenamiento separado.

El link precarga la clave en el campo, pero igual hay que tocar "Activar" —
no se activa sola con solo abrir el link.

## Revocar una clave

Si alguien comparte su clave, la perdió, o querés que deje de funcionar:

```
node keys.js revoke CSM-7F3K-9QRT-2LXP
```

La próxima vez que ese celular tenga conexión y abra la app, va a quedar
bloqueado. **Si el celular está sin conexión, la app le sigue funcionando
con el último estado válido hasta que vuelva a tener internet** — es un
trade-off necesario porque la app está pensada para usarse offline.

## Si el usuario borró los datos de su celular o cambió de teléfono

Si el dueño legítimo de una clave pierde el acceso (borró datos del
navegador, reinstaló, cambió de celular), la clave queda "activada" en un
dispositivo que ya no puede probar que es el suyo. Liberala para que la
pueda volver a activar (en el mismo celular o en uno nuevo):

```
node keys.js unbind CSM-7F3K-9QRT-2LXP
```

Esto no crea una clave nueva — la misma clave vuelve a quedar disponible
para el primer celular que la use a partir de ahora.

*Nota:* a propósito no hay una recuperación automática basada solo en la
huella del dispositivo — dos celulares del mismo modelo pueden generar una
huella idéntica, así que confiar solo en eso debilitaría el bloqueo. Por
eso la recuperación pasa por vos.

## Claves de administrador (acceso al editor de cantos)

Una clave normal solo deja *ver* el cancionero. Para que además aparezca el
ícono del editor de cantos (agregar/editar/borrar canciones y categorías),
la clave tiene que generarse con `--admin`:

```
node keys.js generate --note "Admin - [dispositivo, ej: PC Gloria]" --admin
```

Diferencias con una clave normal:

- **Se puede activar desde cualquier dispositivo**, computadora incluida
  (una clave normal solo se puede activar la primera vez desde un celular).
- **Muestra el ícono del editor** apenas se activa — ya no hace falta
  ninguna contraseña local aparte, el rol sale directo de esta clave.

Igual que las claves normales, **cada clave admin se vincula a un solo
dispositivo a la vez**. Si querés editar desde tu celular *y* tu compu,
generá una clave admin para cada uno (con notas claras para no confundirlas
después). Revocar (`node keys.js revoke`) y liberar (`node keys.js unbind`)
funcionan exactamente igual que con las claves normales.

## Ver todas las claves

```
node keys.js list
```

También podés ver/editar la tabla `access_keys` directamente en el SQL
Editor o el Table Editor de tu proyecto en supabase.com.

## Setup inicial (una sola vez)

1. Creá una cuenta y un proyecto en [supabase.com](https://supabase.com) (gratis, sin tarjeta).
2. Pegá el contenido de `supabase/migrations/0001_access_keys.sql` en el SQL Editor del proyecto y ejecutalo.
3. Copiá `scripts/.env.example` a `scripts/.env` y completá `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API). **Nunca subas ese archivo ni compartas esa clave** — da acceso total a la base de datos.
4. Desplegá la función: `npx supabase login` (una vez) y después `npx supabase functions deploy validate-key --project-ref TU-PROJECT-REF --no-verify-jwt`.
5. Actualizá la constante `VALIDATE_URL` en `index.html` con la URL real de la función desplegada y publicá el cambio.

## Límites conocidos

No existe un bloqueo 100% infalible en la web. Este sistema cubre bien el
caso normal (compartir el link/clave con un conocido, revenderla, etc.);
alguien con conocimientos avanzados podría, en teoría, interceptar y
reproducir el token de un dispositivo. No se construyó protección adicional
contra eso a propósito, para no complicar el sistema más de lo necesario.
