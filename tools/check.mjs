import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parsePackage } from "../scripts/format.js";

const root = new URL("../", import.meta.url);
for (const name of readdirSync(new URL("scripts/", root))) {
  if (!name.endsWith(".js")) continue;
  const result = spawnSync(process.execPath, ["--check", fileURLToPath(new URL(`scripts/${name}`, root))], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
}
const manifest = JSON.parse(readFileSync(new URL("module.json", root), "utf8"));
for (const path of [...manifest.esmodules, ...manifest.styles, manifest.readme, "templates/import.hbs"]) readFileSync(new URL(path, root));
const pkg = parsePackage(readFileSync(new URL("examples/tres-notas.oveja.json", root), "utf8"));
if (pkg.notas.length !== 3) throw new Error("El ejemplo debe contener tres notas.");
console.log("Sintaxis, recursos del módulo y ejemplo: correctos.");
