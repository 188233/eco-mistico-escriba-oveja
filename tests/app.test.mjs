import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../examples/tres-notas.oveja.json", import.meta.url), "utf8");
class Application {
  async render() { return this; }
  async _prepareContext() { return {}; }
}
globalThis.foundry = { applications: { api: { ApplicationV2: Application, HandlebarsApplicationMixin: Base => Base } } };
globalThis.game = { user: { isGM: true }, journal: [], folders: [] };
globalThis.ui = { notifications: { info() {}, warn() {} } };
globalThis.CONFIG = {
  Folder: { documentClass: { async create(data) {
    const folder = { ...data, id: `folder-${game.folders.length}` }; game.folders.push(folder); return folder;
  } } },
  JournalEntry: { documentClass: { async create(data) {
    const journal = { ...data, id: `journal-${game.journal.length}` }; game.journal.push(journal); return journal;
  } } }
};
const { OvejaApplication } = await import("../scripts/app.js");
const file = { name: "tres-notas.oveja.json", size: Buffer.byteLength(raw), text: async () => raw };

test("cargar un archivo inválido elimina el paquete anterior y deshabilita importar", async () => {
  const app = new OvejaApplication();
  await app.loadFile(file);
  assert.equal((await app._prepareContext({})).pending, 3);
  await app.loadFile({ name: "roto.json", size: 1, text: async () => "{" });
  const context = await app._prepareContext({});
  assert.equal(context.hasPackage, false);
  assert.equal(context.importDisabled, true);
  assert.match(context.error, /JSON válido/);
});

test("la acción de importar respeta selección, entrega informe y desactiva las notas creadas", async () => {
  game.journal = []; game.folders = [];
  const app = new OvejaApplication();
  await app.loadFile(file);
  app.selection = new Set([app.pkg.notas[1].id]);
  await OvejaApplication.DEFAULT_OPTIONS.actions.import.call(app);
  const context = await app._prepareContext({});
  assert.equal(context.report.created.length, 1);
  assert.equal(game.journal[0].name, app.pkg.notas[1].titulo);
  assert.equal(context.importDisabled, true);
  assert.equal(context.notes[1].duplicate, true);
  assert.equal(context.notes[0].duplicate, false);
});

test("bloquea otra carga mientras lee el archivo y no importa contenido anterior", async () => {
  game.journal = []; game.folders = [];
  const app = new OvejaApplication();
  let release;
  const reading = new Promise(resolve => { release = resolve; });
  const load = app.loadFile({ name: "lento.json", size: file.size, text: () => reading });
  assert.equal(app.busy, true);
  assert.equal(app.pkg, null);
  await app.loadFile({ name: "otro.json", size: 1, text: async () => "{" });
  assert.equal(app.filename, "lento.json");
  release(raw);
  await load;
  assert.equal(app.pkg.notas.length, 3);
  assert.equal(app.busy, false);
});
