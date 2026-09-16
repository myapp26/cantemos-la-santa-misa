-- Tabla para el contenido de canciones restringidas (candado/oculta/premium).
-- No viaja en canciones.js (archivo publico, sin autenticacion, cargado con
-- <script src="canciones.js"> por cualquiera) -- se guarda aca y solo la
-- entrega la funcion get-letra, tras validar que la clave ya vinculada es
-- premium o admin. Ver claude/analisis-tecnico-cancionero.md (16/9/2026,
-- "letras restringidas fuera del bundle publico") en el proyecto de Claude
-- "App cancionero" para el contexto completo.
create table if not exists letras_restringidas (
  id text primary key,
  letra text not null default '',
  updated_at timestamptz not null default now()
);

-- Sin politicas de lectura publica: la tabla solo se toca con la service
-- role key, desde scripts/sync-letras.js (subir) y desde la funcion de
-- servidor get-letra (leer). Nunca directo desde el cliente.
alter table letras_restringidas enable row level security;
