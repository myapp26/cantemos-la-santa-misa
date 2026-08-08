-- Agrega distincion de rol a access_keys: las claves marcadas is_admin
-- pueden activarse desde cualquier dispositivo (compu incluida), sin pasar
-- por el bloqueo mobile-only que aplica a las claves normales de clientes.
alter table access_keys
  add column if not exists is_admin boolean not null default false;
