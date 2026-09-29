-- Agrega el tier "beneficiario" (rol "beneficiario de uso exclusivo") a la
-- restriccion de access_keys.tier (ver 0003_tier.sql). Ve el catalogo
-- completo igual que el admin, incluidas las canciones "privada" (ver
-- get-letra/index.ts), pero nunca tiene acceso al panel de configuracion/
-- edicion -- eso depende exclusivamente de is_admin, sin relacion con tier.
-- Ver claude/analisis-tecnico-cancionero.md en el proyecto de Claude "App
-- cancionero" (28/9/2026).
do $$
declare
  nombre_restriccion text;
begin
  select conname into nombre_restriccion
  from pg_constraint
  where conrelid = 'access_keys'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%tier%';

  if nombre_restriccion is not null then
    execute format('alter table access_keys drop constraint %I', nombre_restriccion);
  end if;
end $$;

alter table access_keys
  add constraint access_keys_tier_check
    check (tier in ('freemium', 'premium', 'beneficiario'));
