#!/usr/bin/env node
// Sube a Supabase la letra completa de las canciones restringidas
// (candado/oculta/premium), para que get-letra pueda entregarlas bajo
// demanda a usuarios premium/admin. El archivo publico canciones.js NUNCA
// lleva esa letra -- "Generar archivo para publicar" la publica vacia ahi
// a proposito (ver publishFile() en index.html).
//
// Uso:
//   node sync-letras.js letras-restringidas.json
//
// Ese archivo lo descarga el mismo boton "Generar archivo para publicar"
// del panel admin, junto con canciones.js. Corre este script una vez, cada
// vez que publicas y cambio alguna cancion restringida (nueva letra, o una
// cancion que paso a estar restringida por primera vez). Si no cambio
// ninguna, no hace falta correrlo.
//
// Requiere scripts/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// (copiar scripts/.env.example). La service role key nunca debe subirse
// al repo ni compartirse: da acceso total a la base de datos, sin RLS.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en scripts/.env");
  process.exit(1);
}

const path = process.argv[2];
if (!path) {
  console.error("Uso: node sync-letras.js letras-restringidas.json");
  process.exit(1);
}

let items;
try {
  items = JSON.parse(readFileSync(path, "utf-8"));
} catch (e) {
  console.error(`No se pudo leer ${path}: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(items)) {
  console.error("El archivo debe ser un array de { id, letra }");
  process.exit(1);
}

const rows = items
  .filter((it) => it && typeof it.id === "string" && it.id)
  .map((it) => ({
    id: it.id,
    letra: typeof it.letra === "string" ? it.letra : "",
    updated_at: new Date().toISOString(),
  }));

if (rows.length === 0) {
  console.log("Nada para sincronizar (no hay canciones restringidas con letra en el archivo).");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const { error } = await supabase.from("letras_restringidas").upsert(rows);

if (error) {
  console.error("Error subiendo a Supabase:", error.message);
  process.exit(1);
}

console.log(`Sincronizadas ${rows.length} canciones restringidas a Supabase.`);
