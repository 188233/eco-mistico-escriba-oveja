import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parsePackage } from "../scripts/format.js";
import Handlebars from "handlebars";

const root = new URL("../", import.meta.url);
for (const name of readdirSync(new URL("scripts/", root))) {
  if (!name.endsWith(".js")) continue;
  const result = spawnSync(process.execPath, ["--check", fileURLToPath(new URL(`scripts/${name}`, root))], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
}
const manifest = JSON.parse(readFileSync(new URL("module.json", root), "utf8"));
for (const path of [...manifest.esmodules, ...manifest.styles, manifest.readme, manifest.license, manifest.changelog, "templates/import.hbs"]) readFileSync(new URL(path, root));
const pkg = parsePackage(readFileSync(new URL("examples/tres-notas.oveja.json", root), "utf8"));
if (pkg.notas.length !== 3) throw new Error("El ejemplo debe contener tres notas.");
const book = parsePackage(readFileSync(new URL("examples/expediente-demo.oveja.json", root), "utf8"));
if (book.version !== 2 || book.notas[0].paginas.length !== 3 || book.imagenes.length !== 2) throw new Error("Ejemplo ilustrado incompleto.");
Handlebars.precompile(readFileSync(new URL("templates/import.hbs", root), "utf8"));
console.log("Sintaxis, plantilla, recursos y ejemplos v1/v2: correctos.");
