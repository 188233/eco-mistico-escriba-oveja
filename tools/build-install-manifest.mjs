import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const module = JSON.parse(readFileSync(new URL("module.json", root), "utf8"));
const asset = `${module.id}-${module.version}.zip`;
const sha256 = createHash("sha256").update(readFileSync(new URL(`dist/${asset}`, root))).digest("hex").toUpperCase();
const manifest = {
  schemaVersion: 1, channel: "public", foundryVersion: "14.364",
  modules: [{ id: module.id, version: module.version, repository: "188233/eco-mistico-escriba-oveja",
    release: `v${module.version}`, asset, sha256 }]
};
writeFileSync(new URL("dist/escriba-oveja-install-manifest.json", root), JSON.stringify(manifest, null, 2) + "\n");
copyFileSync(new URL("tools/install-escriba-oveja.py", root), new URL("dist/install-escriba-oveja.py", root));
copyFileSync(new URL("docs/INSTALL-UBUNTU.txt", root), new URL("dist/INSTALL-UBUNTU.txt", root));
console.log(`Manifiesto de instalacion: ${asset} · ${sha256}`);
