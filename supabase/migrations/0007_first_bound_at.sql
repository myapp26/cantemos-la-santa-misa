-- Fecha del PRIMER vinculo de una clave a un dispositivo, para no confundirla
-- con bound_at (que se pisa cada vez que hay un re-vinculo: perdida de
-- datos locales con cooldown de 30 dias, o re-vinculo de admin). Se usa para
-- contar el periodo de prueba de "beneficiario de uso exclusivo" (13/11/2026)
-- desde el momento en que esa persona activo la clave la primera y unica
-- vez en su celular -- no desde que Gloria genero la clave (created_at) ni
-- desde el ultimo re-vinculo (bound_at), a pedido explicito de Gloria. Ver
-- claude/analisis-tecnico-cancionero.md en el proyecto de Claude "App
-- cancionero".
alter table access_keys add column if not exists first_bound_at timestamptz;

-- Backfill para claves ya vinculadas antes de este cambio: no tenemos el
-- momento exacto del primer vinculo, así que bound_at (el único dato que
-- existe) es la mejor aproximación disponible -- para cualquier clave
-- existente hoy, es ademas su único vínculo hasta ahora.
update access_keys
  set first_bound_at = bound_at
  where first_bound_at is null and bound_at is not null;
