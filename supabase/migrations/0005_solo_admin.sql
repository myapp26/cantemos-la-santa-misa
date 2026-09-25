-- Cantos "privada" (25/9/2026): uso personal de la administradora (p.ej.
-- cantos de autores con derechos protegidos que no se publican al publico).
-- get-letra entrega su letra SOLO a claves con is_admin = true, nunca a
-- premium. sync-letras.js llena esta columna desde letras-restringidas.json
-- (campo solo_admin que genera publishFile() en index.html).
--
-- IMPORTANTE: correr esta migracion ANTES de desplegar la nueva version de
-- get-letra y antes de correr sync-letras.js -- ambos usan la columna.
alter table letras_restringidas
  add column if not exists solo_admin boolean not null default false;
