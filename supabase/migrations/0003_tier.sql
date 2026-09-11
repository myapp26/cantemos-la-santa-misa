-- Agrega nivel de acceso (tier) a access_keys, para el modelo de versiones
-- Demo/Freemium/Premium (ver claude/plan-versiones-cancionero.md en el
-- proyecto de Claude "App cancionero").
--
-- Demo no requiere clave -- sigue siendo acceso abierto (lanzamiento por
-- fases de index.html), asi que esta columna solo aplica a claves
-- Freemium/Premium. Las claves is_admin no dependen de tier: siempre tienen
-- acceso completo sin importar este valor.
alter table access_keys
  add column if not exists tier text not null default 'freemium'
    check (tier in ('freemium', 'premium'));

-- Nota: las 4 claves que ya existian (creadas antes de este cambio) quedan
-- en 'freemium' por ser el default de la columna -- decision de Gloria
-- (9/9/2026), ya que esos usuarios aportaron antes de que existiera el
-- modelo de niveles. No hace falta un UPDATE aparte para eso.
