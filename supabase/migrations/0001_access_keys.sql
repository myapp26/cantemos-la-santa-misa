-- Claves de acceso vinculadas a dispositivo para "Cantemos para la Santa Misa".
-- Ejecutar una sola vez en el SQL Editor de Supabase (o via `supabase db push`).

create table if not exists access_keys (
  id uuid primary key default gen_random_uuid(),
  key_code text unique not null,
  status text not null default 'unused' check (status in ('unused', 'bound', 'revoked')),
  device_fingerprint text,
  device_token_hash text,
  note text,
  created_at timestamptz not null default now(),
  bound_at timestamptz,
  revoked_at timestamptz
);

create index if not exists access_keys_key_code_idx on access_keys (key_code);

-- RLS habilitado sin policies para anon/authenticated: la tabla solo es
-- alcanzable desde la Edge Function, que usa la service_role key (que
-- ignora RLS). Así el frontend nunca puede leer ni escribir esta tabla
-- directamente, aunque conociera la URL de Supabase.
alter table access_keys enable row level security;
