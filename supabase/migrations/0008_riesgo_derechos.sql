-- 0008: clasificación de riesgo de derechos de autor por canción (solo admin).
-- Se llena con scripts/sync-riesgo.js y se entrega únicamente a claves admin
-- vía la función get-riesgo. Nunca viaja en el canciones.js público.

create table if not exists public.riesgo_derechos (
  id            text primary key,              -- mismo id que en canciones.js
  clasificacion text not null
                check (clasificacion in ('LIBRE','CONTACTAR','LICENCIA','PENDIENTE')),
  verificado    text,                          -- SI / PROBABLE / NO
  autor_final   text,
  fuente        text,
  updated_at    timestamptz not null default now()
);

-- RLS activado y SIN políticas: nadie lee ni escribe con la clave pública (anon).
-- Solo la service role (funciones Edge y scripts) puede acceder.
alter table public.riesgo_derechos enable row level security;
