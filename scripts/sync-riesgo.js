#!/usr/bin/env node
// Sube a Supabase la clasificacion de riesgo de derechos de autor de cada
// cancion (tabla riesgo_derechos, migracion 0008), para que la funcion
// get-riesgo se la entregue SOLO a la administradora. Esa clasificacion
// nunca va en el canciones.js publico.
//
// Uso:
//   node sync-riesgo.js riesgo.json          (sube a Supabase)
//   node sync-riesgo.js riesgo.json --dry    (solo valida, no se conecta)
//
// riesgo.json es un array de { id, clasificacion, verificado, autor_final,
// fuente }, generado desde autores_review.csv. NO lo subas al repo (esta en
// .gitignore): contiene tu evaluacion de riesgo.
//
// Requiere scripts/.env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, igual
// que sync-letras.js.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const VALIDAS = ["LIBRE", "CONTACTAR", "LICENCIA", "PENDIENTE"];

const path = process.argv[2];
const dry = process.argv.includes("--dry");
if (!path) {
  console.error("Uso: node sync-riesgo.js riesgo.json [--dry]");
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
  console.error("El archivo debe ser un array de { id, clasificacion, ... }");
  process.exit(1);
}

const invalidas = items.filter((it) => !it || typeof it.id !== "string" || !it.id || !VALIDAS.includes(it.clasificacion));
if (invalidas.length > 0) {
  console.error(`Hay ${invalidas.length} filas con id vacio o clasificacion fuera de ${VALIDAS.join("/")}. Primera: ${JSON.stringify(invalidas[0])}`);
  process.exit(1);
}

const ahora = new Date().toISOString();
const rows = items.map((it) => ({
  id: it.id,
  clasificacion: it.clasificacion,
  verificado: it.verificado || null,
  autor_final: it.autor_final || null,
  fuente: it.fuente || null,
  updated_at: ahora,
}));

const conteo = {};
for (const r of rows) conteo[r.clasificacion] = (conteo[r.clasificacion] || 0) + 1;

if (rows.length === 0) {
  console.log("Nada para sincronizar.");
  process.exit(0);
}

if (dry) {
  console.log(`[--dry] Archivo valido: ${rows.length} filas. ${JSON.stringify(conteo)}. No se subio nada.`);
  process.exit(0);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en scripts/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const { error } = await supabase.from("riesgo_derechos").upsert(rows);
if (error) {
  console.error("Error subiendo a Supabase:", error.message);
  process.exit(1);
}

console.log(`Sincronizadas ${rows.length} clasificaciones de riesgo a Supabase. ${JSON.stringify(conteo)}`);
