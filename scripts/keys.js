#!/usr/bin/env node
// Generar, listar, revocar y cambiar de nivel las claves de acceso.
//
// Uso:
//   node keys.js generate [--note "Parroquia San Jose"] [--n 1] [--admin] [--tier freemium|premium]
//   node keys.js list
//   node keys.js revoke CSM-XXXX-XXXX-XXXX
//   node keys.js set-tier CSM-XXXX-XXXX-XXXX freemium|premium
//
// --admin marca la clave como administradora: se puede activar desde
// cualquier dispositivo (compu incluida). Sin ese flag, la clave solo
// se puede activar la primera vez desde un celular (comportamiento normal
// de cliente).
//
// --tier asigna el nivel de acceso (freemium o premium). Por defecto,
// freemium. No aplica a claves --admin (siempre tienen acceso completo,
// sin importar el tier). El nivel "Demo" no usa clave: es el acceso
// abierto que ya tiene la app hoy.
//
// set-tier cambia el nivel de una clave que ya existe (por ejemplo, subir
// a alguien de freemium a premium) sin que el usuario tenga que reactivar
// nada -- el dispositivo ya vinculado sigue funcionando igual.
//
// Requiere scripts/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// (copiar scripts/.env.example). La service role key nunca debe subirse
// al repo ni compartirse: da acceso total a la base de datos, sin RLS.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en scripts/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1
const TIERS_VALIDOS = ["freemium", "premium"];

function randomGroup(len) {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function generateKeyCode() {
  return `CSM-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[name] = next;
        i++;
      } else {
        out[name] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function cmdGenerate(args) {
  const n = parseInt(args.n || "1", 10);
  const note = args.note || null;
  const isAdmin = !!args.admin;
  const tier = (args.tier || "freemium").trim().toLowerCase();
  if (!TIERS_VALIDOS.includes(tier)) {
    console.error(`--tier invalido: "${tier}". Usa uno de: ${TIERS_VALIDOS.join(", ")}`);
    process.exit(1);
  }
  const created = [];
  for (let i = 0; i < n; i++) {
    let keyCode;
    // Reintenta si por casualidad choca con una clave existente.
    for (let attempt = 0; attempt < 5; attempt++) {
      keyCode = generateKeyCode();
      const { data: existing } = await supabase
        .from("access_keys")
        .select("id")
        .eq("key_code", keyCode)
        .maybeSingle();
      if (!existing) break;
    }
    const { error } = await supabase
      .from("access_keys")
      .insert({ key_code: keyCode, note, is_admin: isAdmin, tier });
    if (error) {
      console.error("Error creando clave:", error.message);
      process.exit(1);
    }
    created.push(keyCode);
  }
  console.log(isAdmin ? "Clave(s) admin generada(s) (activable desde cualquier dispositivo):" : `Clave(s) generada(s) [${tier}]:`);
  created.forEach((k) => console.log(" ", k));
  if (created.length === 1) {
    console.log("\nLink para compartir:");
    console.log(`  https://cantemos-la-santa-misa.netlify.app/?key=${created[0]}`);
  }
}

async function cmdRevoke(args) {
  const keyCode = (args._[0] || "").trim().toUpperCase();
  if (!keyCode) {
    console.error("Uso: node keys.js revoke CSM-XXXX-XXXX-XXXX");
    process.exit(1);
  }
  const { data, error } = await supabase
    .from("access_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("key_code", keyCode)
    .select()
    .maybeSingle();
  if (error) {
    console.error("Error revocando:", error.message);
    process.exit(1);
  }
  if (!data) {
    console.error("No existe esa clave.");
    process.exit(1);
  }
  console.log(`Clave ${keyCode} revocada.`);
}

async function cmdUnbind(args) {
  const keyCode = (args._[0] || "").trim().toUpperCase();
  if (!keyCode) {
    console.error("Uso: node keys.js unbind CSM-XXXX-XXXX-XXXX");
    process.exit(1);
  }
  const { data, error } = await supabase
    .from("access_keys")
    .update({
      status: "unused",
      device_fingerprint: null,
      device_token_hash: null,
      bound_at: null,
    })
    .eq("key_code", keyCode)
    .eq("status", "bound")
    .select()
    .maybeSingle();
  if (error) {
    console.error("Error liberando la clave:", error.message);
    process.exit(1);
  }
  if (!data) {
    console.error("No existe esa clave o no estaba activada.");
    process.exit(1);
  }
  console.log(`Clave ${keyCode} liberada. Se puede volver a activar en cualquier celular.`);
}

async function cmdSetTier(args) {
  const keyCode = (args._[0] || "").trim().toUpperCase();
  const tier = (args._[1] || "").trim().toLowerCase();
  if (!keyCode || !tier) {
    console.error("Uso: node keys.js set-tier CSM-XXXX-XXXX-XXXX freemium|premium");
    process.exit(1);
  }
  if (!TIERS_VALIDOS.includes(tier)) {
    console.error(`Tier invalido: "${tier}". Usa uno de: ${TIERS_VALIDOS.join(", ")}`);
    process.exit(1);
  }
  const { data, error } = await supabase
    .from("access_keys")
    .update({ tier })
    .eq("key_code", keyCode)
    .select()
    .maybeSingle();
  if (error) {
    console.error("Error cambiando el nivel:", error.message);
    process.exit(1);
  }
  if (!data) {
    console.error("No existe esa clave.");
    process.exit(1);
  }
  if (data.is_admin) {
    console.log(`Clave ${keyCode} es admin -- el tier no le afecta (siempre tiene acceso completo), pero quedo guardado como [${tier}].`);
  } else {
    console.log(`Clave ${keyCode} ahora es [${tier}]. No hace falta que el usuario haga nada -- se aplica solo en su proxima revalidacion.`);
  }
}

async function cmdList() {
  const { data, error } = await supabase
    .from("access_keys")
    .select("key_code, status, is_admin, tier, note, created_at, bound_at, revoked_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error listando:", error.message);
    process.exit(1);
  }
  if (!data.length) {
    console.log("No hay claves todavia.");
    return;
  }
  for (const k of data) {
    const tag = k.is_admin ? "[admin]" : `[${k.tier}]`;
    console.log(`${k.key_code}  [${k.status}] ${tag}  ${k.note || ""}`.trim());
  }
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const args = parseArgs(rest);
  if (cmd === "generate") return cmdGenerate(args);
  if (cmd === "revoke") return cmdRevoke(args);
  if (cmd === "unbind") return cmdUnbind(args);
  if (cmd === "set-tier") return cmdSetTier(args);
  if (cmd === "list") return cmdList();
  console.log("Comandos: generate [--note '...'] [--n N] [--admin] [--tier freemium|premium] | list | revoke <CLAVE> | unbind <CLAVE> | set-tier <CLAVE> <freemium|premium>");
}

main();
