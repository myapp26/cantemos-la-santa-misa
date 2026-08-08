#!/usr/bin/env node
// Regenera el bloque HASHES_ESPERADOS de ../02-anti-clonacion.js con el
// SHA-256 real de cada archivo listado en ARCHIVOS_CRITICOS.
//
// Se corre solo en cada deploy (ver [build] command en ../../netlify.toml),
// siempre ANTES de la ofuscacion. Tambien se puede correr a mano con
// `npm run hashes` para dejar los valores del repo al dia.
//
// Por que existe: los hashes se mantenian a mano y quedaban viejos apenas se
// tocaba index.html / sw.js / canciones.js / manifest.json. Cuando eso pasa,
// TODO usuario real ve un falso "integridad alterada" en consola hasta que
// alguien lo note. Ya paso una vez (ver seguridad/CLAUDE.md, punto 7).

const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// 06-build/ -> seguridad/ -> raiz del sitio publicado.
const RAIZ_SITIO = path.resolve(__dirname, "..", "..");
const ARCHIVO_ANTICLON = path.resolve(__dirname, "..", "02-anti-clonacion.js");

const MARCA_INICIO = "/* HASHES-AUTOGENERADOS:INICIO */";
const MARCA_FIN = "/* HASHES-AUTOGENERADOS:FIN */";

function fallar(msg) {
  console.error(`[hashes] ERROR: ${msg}`);
  // Cortar el build es a proposito: es preferible un deploy en rojo a
  // publicar la app con hashes mudos o equivocados.
  process.exit(1);
}

// ARCHIVOS_CRITICOS vive en 02-anti-clonacion.js y esa es la unica fuente de
// verdad. Si duplicaramos la lista aca volveriamos a tener dos lugares que se
// desincronizan, que es exactamente el problema que este script resuelve.
function leerArchivosCriticos(fuente) {
  const bloque = fuente.match(/const ARCHIVOS_CRITICOS\s*=\s*\[([\s\S]*?)\]/);
  if (!bloque) {
    fallar("no encontre el array ARCHIVOS_CRITICOS en 02-anti-clonacion.js");
  }
  const rutas = [...bloque[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (!rutas.length) {
    fallar("ARCHIVOS_CRITICOS quedo vacio: no hay nada que verificar");
  }
  return rutas;
}

function sha256DeArchivo(rutaWeb) {
  const rutaDisco = path.join(RAIZ_SITIO, rutaWeb.replace(/^\//, ""));
  let buf;
  try {
    buf = fs.readFileSync(rutaDisco);
  } catch {
    fallar(`no pude leer ${rutaWeb} (lo busque en ${rutaDisco})`);
  }
  // Netlify (Linux) hace checkout con LF y sirve esos bytes tal cual; en
  // Windows el working tree queda con CRLF por core.autocrlf. Normalizamos
  // para que el hash sea identico corras donde corras, y coincida con el que
  // el navegador calcula sobre el archivo ya publicado.
  const contenido = buf.toString("utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(contenido, "utf8").digest("hex");
}

function construirBloque(rutas, hashes) {
  const lineas = rutas.map(
    (r) => `    ${JSON.stringify(r)}: ${JSON.stringify(hashes[r])},`
  );
  return [
    MARCA_INICIO,
    "  // Generado automaticamente por 06-build/generar-hashes.js en cada",
    "  // deploy. NO editar a mano: lo que pongas aca se pisa en el build.",
    "  const HASHES_ESPERADOS = {",
    ...lineas,
    "  };",
    `  ${MARCA_FIN}`,
  ].join("\n");
}

function main() {
  const fuente = fs.readFileSync(ARCHIVO_ANTICLON, "utf8");

  const desde = fuente.indexOf(MARCA_INICIO);
  const hasta = fuente.indexOf(MARCA_FIN);
  if (desde === -1 || hasta === -1 || hasta < desde) {
    fallar(
      `no encontre los marcadores ${MARCA_INICIO} ... ${MARCA_FIN} en 02-anti-clonacion.js`
    );
  }

  const rutas = leerArchivosCriticos(fuente);
  const hashes = {};
  for (const ruta of rutas) {
    hashes[ruta] = sha256DeArchivo(ruta);
    console.log(`[hashes] ${ruta.padEnd(16)} ${hashes[ruta].slice(0, 12)}…`);
  }

  const salida =
    fuente.slice(0, desde) +
    construirBloque(rutas, hashes) +
    fuente.slice(hasta + MARCA_FIN.length);

  if (salida === fuente) {
    console.log(`[hashes] ${rutas.length} archivo(s), sin cambios.`);
    return;
  }
  fs.writeFileSync(ARCHIVO_ANTICLON, salida);
  console.log(`[hashes] ${rutas.length} archivo(s), 02-anti-clonacion.js actualizado.`);
}

main();
