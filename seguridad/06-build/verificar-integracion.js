#!/usr/bin/env node
// Corre en cada build de Netlify, ANTES de generar hashes/ofuscar.
// Falla el build (exit 1) si index.html se publicó sin la integracion de
// seguridad/accesos -- evita que una regresion como la de agosto 2026 (donde
// index.html volvio a una version sin el sistema de claves de Supabase, sin
// que nadie lo notara durante semanas) vuelva a llegar a produccion en
// silencio. Ver claude/auditoria-seguridad-cancionero.md (proyecto de Claude
// "App cancionero") para el contexto completo de ese hallazgo.
//
// Que verifica (todo debe estar presente en index.html):
//   1. Los 3 <script src="/seguridad/0N-...js"> antes de </body>.
//   2. El sistema de acceso por clave (VALIDATE_URL, initAccessGate,
//      esAdmin) sigue conectado -- no solo existente en seguridad/, sino
//      realmente enganchado al index.html que se publica.
//
// Si un cambio legitimo necesita quitar o renombrar algo de esta lista,
// actualiza MARCADORES_REQUERIDOS en este mismo commit -- no borres el
// chequeo para que pase.

const fs = require("fs");
const path = require("path");

const INDEX_HTML = path.join(__dirname, "..", "..", "index.html");

const MARCADORES_REQUERIDOS = [
  { nombre: "script seguridad/01-sello-marca-agua.js", patron: /seguridad\/01-sello-marca-agua\.js/ },
  { nombre: "script seguridad/02-anti-clonacion.js", patron: /seguridad\/02-anti-clonacion\.js/ },
  { nombre: "script seguridad/03-anti-manipulacion.js", patron: /seguridad\/03-anti-manipulacion\.js/ },
  { nombre: "VALIDATE_URL (endpoint de validate-key en Supabase)", patron: /VALIDATE_URL\s*=/ },
  { nombre: "initAccessGate() (compuerta de acceso por clave)", patron: /initAccessGate\s*\(/ },
  { nombre: "esAdmin() (rol de admin derivado de la clave, no de contraseña local)", patron: /function\s+esAdmin\s*\(/ },
];

let html;
try {
  html = fs.readFileSync(INDEX_HTML, "utf8");
} catch (e) {
  console.error(`✗ No se pudo leer ${INDEX_HTML}: ${e.message}`);
  process.exit(1);
}

const faltantes = MARCADORES_REQUERIDOS.filter((m) => !m.patron.test(html));

if (faltantes.length) {
  console.error("✗ index.html no tiene la integracion de seguridad/accesos completa. Build detenido.\n");
  console.error("Falta:");
  faltantes.forEach((m) => console.error(`  - ${m.nombre}`));
  console.error(
    "\nEsto normalmente pasa cuando index.html se reemplazo desde una copia " +
    "vieja (backup, exportacion, sesion anterior) sin revisar el diff antes. " +
    "Revisa el commit/PR que toco index.html y confirma que estos bloques " +
    "sigan ahi antes de publicar."
  );
  process.exit(1);
}

console.log("✓ index.html tiene la integracion de seguridad/accesos completa (" + MARCADORES_REQUERIDOS.length + " marcadores verificados).");
